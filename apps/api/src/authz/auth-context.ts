export type AuthContext = {
  userId: string
  userName: string
  userEmail: string
  orgId: string
  orgName: string
  membershipId: string
  roles: { id: string; name: string }[]
  isSystemAdmin: boolean
  // union of every assigned role's permissions; irrelevant (and empty) when isSystemAdmin
  permissions: Set<string>
  // null = full access (isSystemAdmin), mirrors the prototype's Viewer.scopeTags
  scopeTagNames: string[] | null
}
