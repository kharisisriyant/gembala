import { z } from "zod"

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const tagNameSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be a lowercase slug (a-z, 0-9, hyphens)")

export const memberStatusSchema = z.enum(["active", "newcomer", "inactive"])
export type MemberStatus = z.infer<typeof memberStatusSchema>

export const membershipRoleSchema = z.enum(["admin", "leader"])
export type MembershipRole = z.infer<typeof membershipRoleSchema>

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "must be an ISO date (YYYY-MM-DD)")
const password = z.string().min(8, "password must be at least 8 characters").max(128)

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password,
  organizationName: z.string().min(1).max(100),
})
export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password,
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  name: z.string().min(1).max(100),
  password,
})
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>

export type MeResponse = {
  user: { id: string; name: string; email: string }
  org: { id: string; name: string }
  role: MembershipRole
  roleLabel: string
  // null = admin / full access, mirrors the prototype's Viewer.scopeTags
  scopeTags: string[] | null
}

export type AuthResponse = {
  token: string
  me: MeResponse
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tagCreateSchema = z.object({
  name: tagNameSchema,
  parent: tagNameSchema.nullable(),
  description: z.string().max(500).optional(),
})
export type TagCreateInput = z.infer<typeof tagCreateSchema>

export const tagUpdateSchema = z.object({
  parent: tagNameSchema.nullable().optional(),
  description: z.string().max(500).nullable().optional(),
})
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>

export type TagResponse = {
  name: string
  parent: string | null
  description?: string
  directCount: number
  subtreeCount: number
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberCreateSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255).or(z.literal("")),
  phone: z.string().max(50).or(z.literal("")),
  tags: z.array(tagNameSchema).min(1, "pick at least one tag"),
  status: memberStatusSchema.default("active"),
  joinedAt: isoDate.optional(),
})
export type MemberCreateInput = z.infer<typeof memberCreateSchema>

export const memberUpdateSchema = memberCreateSchema.partial()
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>

export type MemberResponse = {
  id: string
  name: string
  email: string
  phone: string
  tags: string[]
  status: MemberStatus
  joinedAt: string
}

export type MemberDetailResponse = MemberResponse & {
  groups: { id: string; name: string }[]
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export const groupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  leaderId: z.string().uuid(),
  scopeTag: tagNameSchema,
  memberIds: z.array(z.string().uuid()),
  schedule: z.string().max(100).or(z.literal("")),
  location: z.string().max(200).or(z.literal("")),
})
export type GroupCreateInput = z.infer<typeof groupCreateSchema>

export const groupUpdateSchema = groupCreateSchema.partial()
export type GroupUpdateInput = z.infer<typeof groupUpdateSchema>

export type GroupSummaryResponse = {
  id: string
  name: string
  leader: { id: string; name: string } | null
  scopeTag: string
  members: { id: string; name: string }[]
  memberCount: number
  schedule: string
  location: string
  lastSessionDate: string | null
  lastSessionPresent: number | null
}

export type SessionResponse = {
  id: string
  groupId: string
  date: string
  presentIds: string[]
  topic: string
  prayerNotes: string
}

export type GroupDetailResponse = {
  id: string
  name: string
  leader: { id: string; name: string } | null
  scopeTag: string
  schedule: string
  location: string
  members: MemberResponse[]
  sessions: SessionResponse[]
  stats: {
    meetingsLogged: number
    avgAttendance: number
    memberCount: number
  }
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const sessionCreateSchema = z.object({
  date: isoDate,
  topic: z.string().max(200).or(z.literal("")),
  presentIds: z.array(z.string().uuid()),
  prayerNotes: z.string().max(2000).or(z.literal("")),
})
export type SessionCreateInput = z.infer<typeof sessionCreateSchema>

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

export const inviteCreateSchema = z.object({
  email: z.string().email().max(255),
  roleLabel: z.string().min(1).max(100),
  scopeTags: z.array(tagNameSchema).min(1, "pick at least one scope tag"),
})
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>

export type InviteResponse = {
  id: string
  email: string
  roleLabel: string
  scopeTags: string[]
  status: "pending" | "accepted" | "revoked" | "expired"
  createdAt: string
  expiresAt: string
}

export type InvitePreviewResponse = {
  orgName: string
  email: string
  roleLabel: string
  scopeTags: string[]
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export type DashboardResponse = {
  memberCount: number
  activeCount: number
  newcomerCount: number
  groupCount: number
  avgAttendance: number
  recentSessions: {
    id: string
    groupId: string
    groupName: string
    date: string
    topic: string
    presentCount: number
    presentNames: string[]
  }[]
  tagHistogram: { tag: string; count: number }[]
  prayerNotes: { groupName: string; date: string; notes: string }[]
}

// ---------------------------------------------------------------------------
// Telegram
// ---------------------------------------------------------------------------

export type TelegramLinkStatusResponse =
  | { linked: true; telegramUsername: string | null }
  | {
      linked: false
      code: string
      expiresAt: string
      botConfigured: boolean
      botUsername: string | null
    }
