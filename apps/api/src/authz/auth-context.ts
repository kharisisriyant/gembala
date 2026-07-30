import type { MembershipRole } from "@gembala/shared"

// Attached to every authenticated request by JwtAuthGuard. scopeTagNames is
// null for admins (full access) — mirrors the prototype's Viewer.scopeTags.
export type AuthContext = {
  userId: string
  userName: string
  userEmail: string
  orgId: string
  orgName: string
  membershipId: string
  role: MembershipRole
  roleLabel: string
  scopeTagNames: string[] | null
}
