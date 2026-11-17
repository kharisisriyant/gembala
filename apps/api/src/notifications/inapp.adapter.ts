import { Injectable } from "@nestjs/common"
import type { ChannelAdapter, SendResult } from "./notifications.adapter"

// The inbox row is written by the router in the same transaction as the
// notification, so "sending" in-app is already done; the delivery just records it.
@Injectable()
export class InAppAdapter implements ChannelAdapter {
  readonly channel = "inapp" as const
  async available() {
    return true
  }
  async send(): Promise<SendResult> {
    return { kind: "accepted" }
  }
}
