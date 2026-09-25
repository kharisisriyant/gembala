import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import type { MemberRelationshipResponse, MemberRelationType, RelationshipCreateInput } from "@gembala/shared"
import { and, eq, or } from "drizzle-orm"
import { InjectDb, type Db } from "../db/drizzle.module"
import { memberRelationships } from "../db/schema"
import type { AuthContext } from "../authz/auth-context"
import { MembersService } from "./members.service"

// spouse/sibling are undirected facts: store once with the smaller uuid as
// memberId so (A, B, spouse) and (B, A, spouse) never both exist.
const SYMMETRIC_TYPES: MemberRelationType[] = ["spouse", "sibling_of"]

// A row is always (memberId, relatedMemberId, relationType) meaning
// "memberId <verb> relatedMemberId" (e.g. memberId is parent_of relatedMemberId).
// Reading it back for either side just needs the right label.
function labelFromSubjectSide(relationType: MemberRelationType): string {
  switch (relationType) {
    case "spouse":
      return "spouse"
    case "parent_of":
      return "child"
    case "sibling_of":
      return "sibling"
    case "guardian_of":
      return "ward"
    case "grandparent_of":
      return "grandchild"
    case "other":
      return "other"
  }
}

function labelFromObjectSide(relationType: MemberRelationType): string {
  switch (relationType) {
    case "spouse":
      return "spouse"
    case "parent_of":
      return "parent"
    case "sibling_of":
      return "sibling"
    case "guardian_of":
      return "guardian"
    case "grandparent_of":
      return "grandparent"
    case "other":
      return "other"
  }
}

function canonicalPair(
  memberId: string,
  relatedMemberId: string,
  relationType: MemberRelationType,
): { memberId: string; relatedMemberId: string } {
  if (SYMMETRIC_TYPES.includes(relationType) && relatedMemberId < memberId) {
    return { memberId: relatedMemberId, relatedMemberId: memberId }
  }
  return { memberId, relatedMemberId }
}

@Injectable()
export class MemberRelationshipsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly members: MembersService,
  ) {}

  async list(auth: AuthContext, memberId: string): Promise<MemberRelationshipResponse[]> {
    // reuse detail()'s existence + scope check (404s for unknown/out-of-scope ids)
    await this.members.detail(auth, memberId)
    const orgMembers = await this.members.orgMembersWithTags(auth.orgId)
    const nameById = new Map(orgMembers.map((m) => [m.id, m.name]))

    const rows = await this.db
      .select()
      .from(memberRelationships)
      .where(or(eq(memberRelationships.memberId, memberId), eq(memberRelationships.relatedMemberId, memberId)))

    const result: MemberRelationshipResponse[] = []
    for (const r of rows) {
      const isSubject = r.memberId === memberId
      const otherId = isSubject ? r.relatedMemberId : r.memberId
      const otherName = nameById.get(otherId)
      if (!otherName) continue // other member outside org/scope — don't leak
      result.push({
        relatedMemberId: otherId,
        relatedMemberName: otherName,
        relationType: r.relationType,
        label: isSubject ? labelFromSubjectSide(r.relationType) : labelFromObjectSide(r.relationType),
      })
    }
    return result.sort((a, b) => a.relatedMemberName.localeCompare(b.relatedMemberName))
  }

  async create(
    auth: AuthContext,
    memberId: string,
    input: RelationshipCreateInput,
  ): Promise<MemberRelationshipResponse> {
    if (input.relatedMemberId === memberId) {
      throw new BadRequestException("a member cannot be related to themselves")
    }
    // both ends must exist in this org and be visible to the caller's scope
    await this.members.detail(auth, memberId)
    await this.members.detail(auth, input.relatedMemberId)

    const canonical = canonicalPair(memberId, input.relatedMemberId, input.relationType)
    const [existing] = await this.db
      .select()
      .from(memberRelationships)
      .where(
        and(
          eq(memberRelationships.memberId, canonical.memberId),
          eq(memberRelationships.relatedMemberId, canonical.relatedMemberId),
          eq(memberRelationships.relationType, input.relationType),
        ),
      )
    if (existing) throw new ConflictException("this relationship already exists")

    await this.db.insert(memberRelationships).values({
      memberId: canonical.memberId,
      relatedMemberId: canonical.relatedMemberId,
      relationType: input.relationType,
    })

    const orgMembers = await this.members.orgMembersWithTags(auth.orgId)
    const relatedMemberName = orgMembers.find((m) => m.id === input.relatedMemberId)!.name
    return {
      relatedMemberId: input.relatedMemberId,
      relatedMemberName,
      relationType: input.relationType,
      label: labelFromSubjectSide(input.relationType),
    }
  }

  async remove(
    auth: AuthContext,
    memberId: string,
    relatedMemberId: string,
    relationType: MemberRelationType,
  ): Promise<void> {
    await this.members.detail(auth, memberId)
    const canonical = canonicalPair(memberId, relatedMemberId, relationType)
    const result = await this.db
      .delete(memberRelationships)
      .where(
        and(
          eq(memberRelationships.memberId, canonical.memberId),
          eq(memberRelationships.relatedMemberId, canonical.relatedMemberId),
          eq(memberRelationships.relationType, relationType),
        ),
      )
      .returning()
    if (result.length === 0) throw new NotFoundException("relationship not found")
  }
}
