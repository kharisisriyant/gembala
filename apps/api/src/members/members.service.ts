import { Injectable, NotFoundException } from "@nestjs/common"
import type {
  MemberCreateInput,
  MemberDetailResponse,
  MemberResponse,
  MemberUpdateInput,
} from "@gembala/shared"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { groupMembers, groups, members, memberTags, tags } from "../db/schema"
import { ScopeService } from "../authz/scope.service"
import type { AuthContext } from "../authz/auth-context"
import { TagsService } from "../tags/tags.service"

@Injectable()
export class MembersService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly scope: ScopeService,
    private readonly tags: TagsService,
  ) {}

  // All org members with their tag names attached — every read path builds on
  // this and then applies the caller's scope filter in memory (org sizes are
  // small; this matches the prototype's semantics exactly).
  async orgMembersWithTags(orgId: string): Promise<MemberResponse[]> {
    const memberRows = await this.db.select().from(members).where(eq(members.orgId, orgId))
    const tagRows = await this.db
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .innerJoin(members, eq(members.id, memberTags.memberId))
      .where(eq(members.orgId, orgId))

    const tagsByMember = new Map<string, string[]>()
    for (const r of tagRows) {
      const list = tagsByMember.get(r.memberId) ?? []
      list.push(r.name)
      tagsByMember.set(r.memberId, list)
    }

    return memberRows.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      status: m.status,
      joinedAt: m.joinedAt,
      tags: (tagsByMember.get(m.id) ?? []).sort(),
    }))
  }

  async list(auth: AuthContext, search?: string, tag?: string): Promise<MemberResponse[]> {
    const scope = await this.scope.expandedScope(auth)
    let visible = (await this.orgMembersWithTags(auth.orgId)).filter((m) =>
      this.scope.memberVisible(scope, m.tags),
    )

    if (search) {
      const q = search.toLowerCase()
      visible = visible.filter(
        (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
      )
    }
    if (tag) visible = visible.filter((m) => m.tags.includes(tag))

    return visible.sort((a, b) => a.name.localeCompare(b.name))
  }

  async detail(auth: AuthContext, id: string): Promise<MemberDetailResponse> {
    const scope = await this.scope.expandedScope(auth)
    const all = await this.orgMembersWithTags(auth.orgId)
    const member = all.find((m) => m.id === id)
    // 404 both for unknown ids and out-of-scope members (don't leak existence)
    if (!member || !this.scope.memberVisible(scope, member.tags)) {
      throw new NotFoundException("member not found")
    }

    const groupRows = await this.db
      .select({ id: groups.id, name: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groups.id, groupMembers.groupId))
      .where(eq(groupMembers.memberId, id))

    return { ...member, groups: groupRows }
  }

  async create(auth: AuthContext, input: MemberCreateInput): Promise<MemberResponse> {
    const scope = await this.scope.expandedScope(auth)
    this.scope.assertCanWriteMemberTags(scope, input.tags)
    const tagIdsByName = await this.tags.resolveTagIds(auth.orgId, input.tags)

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(members)
        .values({
          orgId: auth.orgId,
          name: input.name,
          email: input.email,
          phone: input.phone,
          status: input.status,
          joinedAt: input.joinedAt ?? new Date().toISOString().slice(0, 10),
        })
        .returning()
      await tx.insert(memberTags).values(
        input.tags.map((name) => ({ memberId: row.id, tagId: tagIdsByName.get(name)! })),
      )
      return row
    })

    return {
      id: created.id,
      name: created.name,
      email: created.email,
      phone: created.phone,
      status: created.status,
      joinedAt: created.joinedAt,
      tags: [...input.tags].sort(),
    }
  }

  async update(auth: AuthContext, id: string, input: MemberUpdateInput): Promise<MemberResponse> {
    // reuse detail() for the existence + scope check
    const existing = await this.detail(auth, id)

    if (input.tags) {
      const scope = await this.scope.expandedScope(auth)
      this.scope.assertCanWriteMemberTags(scope, input.tags)
    }

    await this.db.transaction(async (tx) => {
      const patch: Partial<typeof members.$inferInsert> = {}
      if (input.name !== undefined) patch.name = input.name
      if (input.email !== undefined) patch.email = input.email
      if (input.phone !== undefined) patch.phone = input.phone
      if (input.status !== undefined) patch.status = input.status
      if (input.joinedAt !== undefined) patch.joinedAt = input.joinedAt
      if (Object.keys(patch).length > 0) {
        await tx.update(members).set(patch).where(and(eq(members.id, id), eq(members.orgId, auth.orgId)))
      }
      if (input.tags) {
        const tagIdsByName = await this.tags.resolveTagIds(auth.orgId, input.tags)
        await tx.delete(memberTags).where(eq(memberTags.memberId, id))
        await tx.insert(memberTags).values(
          input.tags.map((name) => ({ memberId: id, tagId: tagIdsByName.get(name)! })),
        )
      }
    })

    return {
      ...existing,
      ...("name" in input ? { name: input.name! } : {}),
      ...("email" in input ? { email: input.email! } : {}),
      ...("phone" in input ? { phone: input.phone! } : {}),
      ...("status" in input ? { status: input.status! } : {}),
      ...("joinedAt" in input ? { joinedAt: input.joinedAt! } : {}),
      tags: input.tags ? [...input.tags].sort() : existing.tags,
    }
  }
}
