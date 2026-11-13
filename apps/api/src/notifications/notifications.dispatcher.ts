import { Injectable, Logger } from "@nestjs/common"
import type { NotificationChannel } from "@gembala/shared"
import { InjectDb, type Db } from "../db/drizzle.module"
import { NotificationsQueue } from "./notifications.queue"
import { NotificationsRepository } from "./notifications.repository"

const STUCK_AFTER_MS = 5 * 60_000

// Moves deliveries from Postgres (source of truth) into BullMQ and heals the
// gap when Redis loses a job (D29 steps 3-4).
@Injectable()
export class NotificationsDispatcher {
  private readonly log = new Logger("NotificationsDispatcher")

  constructor(
    private readonly repo: NotificationsRepository,
    private readonly queue: NotificationsQueue,
    @InjectDb() private readonly db: Db,
  ) {}

  // If Redis is down the transaction rolls back and the rows stay pending.
  enqueuePending(limit = 50): Promise<number> {
    return this.db.transaction(async (tx) => {
      const rows = await this.repo.claimPendingDeliveries(limit, tx)
      for (const row of rows) await this.queue.add(row)
      await this.repo.markQueued(
        rows.map((r) => r.id),
        tx,
      )
      return rows.length
    })
  }

  // Re-adds deliveries stuck pending/queued. Safe to repeat: the job id dedupes,
  // and the processor ignores deliveries that already finished.
  async reconcile(now = new Date(), limit = 100): Promise<number> {
    const rows = await this.repo.staleDeliveries(new Date(now.getTime() - STUCK_AFTER_MS), limit)
    for (const row of rows) await this.queue.add(row, now)
    await this.repo.touchDeliveries(rows.map((r) => r.id))
    if (rows.length > 0) this.log.warn(`reconciled ${rows.length} stuck deliveries`)
    return rows.length
  }

  // Replay for failed deliveries (RL-4): back to pending, old failed jobs removed.
  async replayFailed(channel?: NotificationChannel): Promise<number> {
    const rows = await this.repo.resetFailed(channel)
    await this.queue.remove(rows)
    return rows.length
  }
}
