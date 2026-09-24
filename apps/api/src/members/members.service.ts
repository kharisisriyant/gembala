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
      dateOfBirth: m.dateOfBirth,
      gender: m.gender,
      maritalStatus: m.maritalStatus,
      address: m.address,
      occupation: m.occupation,
      notes: m.notes,
      photoUrl: m.photoUrl,
      baptismStatus: m.baptismStatus,
      baptismDate: m.baptismDate,
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
          dateOfBirth: input.dateOfBirth,
          gender: input.gender,
          maritalStatus: input.maritalStatus,
          address: input.address,
          occupation: input.occupation,
          notes: input.notes,
          photoUrl: input.photoUrl,
          baptismStatus: input.baptismStatus,
          baptismDate: input.baptismDate,
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
      dateOfBirth: created.dateOfBirth,
      gender: created.gender,
      maritalStatus: created.maritalStatus,
      address: created.address,
      occupation: created.occupation,
      notes: created.notes,
      photoUrl: created.photoUrl,
      baptismStatus: created.baptismStatus,
      baptismDate: created.baptismDate,
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
      if (input.dateOfBirth !== undefined) patch.dateOfBirth = input.dateOfBirth
      if (input.gender !== undefined) patch.gender = input.gender
      if (input.maritalStatus !== undefined) patch.maritalStatus = input.maritalStatus
      if (input.address !== undefined) patch.address = input.address
      if (input.occupation !== undefined) patch.occupation = input.occupation
      if (input.notes !== undefined) patch.notes = input.notes
      if (input.photoUrl !== undefined) patch.photoUrl = input.photoUrl
      if (input.baptismStatus !== undefined) patch.baptismStatus = input.baptismStatus
      if (input.baptismDate !== undefined) patch.baptismDate = input.baptismDate
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
      ...("dateOfBirth" in input ? { dateOfBirth: input.dateOfBirth ?? null } : {}),
      ...("gender" in input ? { gender: input.gender ?? null } : {}),
      ...("maritalStatus" in input ? { maritalStatus: input.maritalStatus ?? null } : {}),
      ...("address" in input ? { address: input.address! } : {}),
      ...("occupation" in input ? { occupation: input.occupation! } : {}),
      ...("notes" in input ? { notes: input.notes! } : {}),
      ...("photoUrl" in input ? { photoUrl: input.photoUrl! } : {}),
      ...("baptismStatus" in input ? { baptismStatus: input.baptismStatus ?? null } : {}),
      ...("baptismDate" in input ? { baptismDate: input.baptismDate ?? null } : {}),
      tags: input.tags ? [...input.tags].sort() : existing.tags,
    }
  }
}
