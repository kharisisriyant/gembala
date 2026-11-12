import type { CareRequestStatus, InviteResponse } from "./schemas.js"

// Single source of truth for entity lifecycles. The API guards transitions with
// these tables and the web hides actions with the same ones, so a button can
// never offer a move the server would reject. Catalogue of every lifecycle
// (including the free-form and derived ones): apps/api/architecture.md,
// "State machines".

export type Lifecycle<S extends string> = Readonly<Record<S, readonly S[]>>

export const canTransition = <S extends string>(lifecycle: Lifecycle<S>, from: S, to: S): boolean =>
  lifecycle[from].includes(to)

export const careRequestLifecycle: Lifecycle<CareRequestStatus> = {
  open: ["closed"],
  closed: ["open"],
}

export type InviteStatus = InviteResponse["status"]

// accepted / revoked / expired are terminal: an invite never comes back.
export const inviteLifecycle: Lifecycle<InviteStatus> = {
  pending: ["accepted", "revoked", "expired"],
  accepted: [],
  revoked: [],
  expired: [],
}

// Invite status is derived from timestamps, never stored. Precedence matters
// only for legacy rows that were revoked after being accepted.
export function deriveInviteStatus(
  row: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): InviteStatus {
  if (row.revokedAt) return "revoked"
  if (row.acceptedAt) return "accepted"
  if (row.expiresAt < now) return "expired"
  return "pending"
}
