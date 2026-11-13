import { Injectable, type OnModuleDestroy } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import IORedis from "ioredis"

// The one Redis connection shared by the queues and the rate gate. Created on
// first use, so instances that never touch Redis don't need REDIS_URL.
@Injectable()
export class NotificationsRedis implements OnModuleDestroy {
  private client?: IORedis

  constructor(private readonly config: ConfigService) {}

  connection(): IORedis {
    if (!this.client) {
      const url = this.config.get<string>("REDIS_URL")
      if (!url) throw new Error("REDIS_URL is required to run notification workers")
      this.client = new IORedis(url, { maxRetriesPerRequest: null })
    }
    return this.client
  }

  // Cross-instance rate gate (Telegram allows ~1 message/second per chat). Returns 0
  // when the slot was taken, otherwise the milliseconds until it frees.
  async reserve(key: string, ttlMs: number): Promise<number> {
    const taken = await this.connection().set(key, "1", "PX", ttlMs, "NX")
    if (taken) return 0
    return Math.max(1, await this.connection().pttl(key))
  }

  async onModuleDestroy() {
    await this.client?.quit()
  }
}
