import { createHmac, timingSafeEqual } from "node:crypto"

// Public confirm/decline link for one roster assignment: `<assignment id>.<hmac>`.
// The MAC covers the assignment id and the row's link nonce, so the link dies
// when the assignment is deleted or its nonce is rotated (member or role change).
// Nothing secret is stored: a database read alone cannot forge a link.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const mac = (secret: string, assignmentId: string, nonce: string) =>
  createHmac("sha256", secret).update(`roster-response:v1:${assignmentId}:${nonce}`).digest("base64url")

export function signRosterToken(secret: string, assignmentId: string, nonce: string): string {
  return `${assignmentId}.${mac(secret, assignmentId, nonce)}`
}

// The assignment id a token claims, before the MAC is checked against the row.
export function rosterTokenAssignmentId(token: string): string | null {
  const [id, signature, extra] = token.split(".")
  if (extra !== undefined || !id || !signature || !UUID.test(id)) return null
  return id
}

export function rosterTokenMatches(secret: string, token: string, assignmentId: string, nonce: string): boolean {
  const expected = Buffer.from(signRosterToken(secret, assignmentId, nonce))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given)
}
