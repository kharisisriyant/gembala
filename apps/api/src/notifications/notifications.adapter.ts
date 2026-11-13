import type { NotificationChannel } from "@gembala/shared"

export type SendContext = {
  deliveryId: string
  correlationId: string
  notification: {
    id: string
    orgId: string
    userId: string
    typeKey: string
    title: string
    body: string
    link: string | null
  }
}

// What an adapter reports back (AR-4). The worker classifies; adapters never retry.
export type SendResult =
  | { kind: "accepted"; providerMessageId?: string }
  | { kind: "retryable"; code: string; retryAfterMs?: number }
  | { kind: "permanent"; code: string }

export interface ChannelAdapter {
  readonly channel: NotificationChannel
  // Is the user reachable on this channel right now (address verified, link active, not suppressed)?
  available(userId: string): Promise<boolean>
  send(ctx: SendContext): Promise<SendResult>
}

export const CHANNEL_ADAPTERS = Symbol("CHANNEL_ADAPTERS")
