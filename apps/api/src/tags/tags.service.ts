import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type { TagCreateInput, TagResponse, TagUpdateInput } from "@gembala/shared"
import { descendantsOf } from "@gembala/shared"
import { and, eq, inArray } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { groups, members, memberTags, tags } from "../db/schema"
import { ScopeService, type TagRow } from "../authz/scope.service"

@Injectable()
export class TagsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly scope: ScopeService,
  ) {}

  // Translate tag names (the wire/UI identifier) into row ids, failing loudly
  // on unknown names. Used by every module that accepts tag names.
  async resolveTagIds(orgId: string, names: string[]): Promise<Map<string, string>> {
    if (names.length === 0) return new Map()
    const rows = await this.db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(and(eq(tags.orgId, orgId), inArray(tags.name, names)))
    const map = new Map(rows.map((r) => [r.name, r.id]))
    const missing = names.filter((n) => !map.has(n))
    if (missing.length > 0) {
      throw new NotFoundException(`unknown tag(s): ${missing.join(", ")}`)
    }
    return map
  }

  async list(orgId: string): Promise<TagResponse[]> {
    const tagRows = await this.scope.orgTags(orgId)
    const defs = this.scope.toTagDefs(tagRows)

    // memberId -> tag names, for direct + subtree counts
    const mtRows = await this.db
      .select({ memberId: memberTags.memberId, name: tags.name })
      .from(memberTags)
      .innerJoin(tags, eq(tags.id, memberTags.tagId))
      .innerJoin(members, eq(members.id, memberTags.memberId))
      .where(eq(members.orgId, orgId))

    const tagsByMember = new Map<string, Set<string>>()
    for (const r of mtRows) {
      let set = tagsByMember.get(r.memberId)
      if (!set) tagsByMember.set(r.memberId, (set = new Set()))
      set.add(r.name)
    }

    return defs.map((def) => {
      const subtree = new Set([def.name, ...descendantsOf(defs, def.name)])
      let directCount = 0
      let subtreeCount = 0
      for (const memberTagSet of tagsByMember.values()) {
        if (memberTagSet.has(def.name)) directCount++
        for (const t of memberTagSet) {
          if (subtree.has(t)) {
            subtreeCount++
            break
          }
        }
      }
      return { ...def, directCount, subtreeCount }
    })
  }

  async create(orgId: string, input: TagCreateInput): Promise<TagResponse> {
    const existing = await this.db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.orgId, orgId), eq(tags.name, input.name)))
    if (existing.length > 0) throw new ConflictException(`tag "${input.name}" already exists`)

    let parentId: string | null = null
    if (input.parent) {
      parentId = (await this.resolveTagIds(orgId, [input.parent])).get(input.parent)!
    }

    await this.db.insert(tags).values({
      orgId,
      name: input.name,
      parentId,
      description: input.description ?? null,
    })

    return {
      name: input.name,
      parent: input.parent ?? null,
      description: input.description,
      directCount: 0,
      subtreeCount: 0,
    }
  }

  async update(orgId: string, name: string, input: TagUpdateInput): Promise<void> {
    const rows = await this.scope.orgTags(orgId)
    const tag = rows.find((r) => r.name === name)
    if (!tag) throw new NotFoundException(`unknown tag: ${name}`)

    const patch: Partial<{ parentId: string | null; description: string | null }> = {}

    if (input.parent !== undefined) {
      if (input.parent === null) {
        patch.parentId = null
      } else {
        const parent = rows.find((r) => r.name === input.parent)
        if (!parent) throw new NotFoundException(`unknown tag: ${input.parent}`)
        // reject cycles: the new parent must not be the tag itself or any descendant
        const defs = this.scope.toTagDefs(rows)
        if (input.parent === name || descendantsOf(defs, name).includes(input.parent)) {
          throw new ConflictException("cannot move a tag under its own subtree")
        }
        patch.parentId = parent.id
      }
    }
    if (input.description !== undefined) patch.description = input.description

    if (Object.keys(patch).length > 0) {
      await this.db.update(tags).set(patch).where(eq(tags.id, tag.id))
    }
  }

  // Matches the prototype's removeTag: children are re-parented one level up.
  // Blocked (409) when a group uses the tag as its RBAC scope tag.
  async remove(orgId: string, name: string): Promise<void> {
    const rows = await this.scope.orgTags(orgId)
    const tag = rows.find((r) => r.name === name)
    if (!tag) throw new NotFoundException(`unknown tag: ${name}`)

    const [scopedGroup] = await this.db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.scopeTagId, tag.id))
      .limit(1)
    if (scopedGroup) {
      throw new ConflictException(
        `tag "${name}" is the scope tag of group "${scopedGroup.name}" — reassign the group first`,
      )
    }

    await this.db.transaction(async (tx) => {
      await tx.update(tags).set({ parentId: tag.parentId }).where(eq(tags.parentId, tag.id))
      await tx.delete(tags).where(eq(tags.id, tag.id))
    })
  }
}
