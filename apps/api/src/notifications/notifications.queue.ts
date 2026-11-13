import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common"
import { Queue, UnrecoverableError, Worker, type Job } from "bullmq"
import type { NotificationChannel, NotificationPriority } from "@gembala/shared"
import { backoffDelay, type RetryableError } from "./notifications.backoff"
import { DeliveryProcessor } from "./notifications.processor"
import { NotificationsRedis } from "./notifications.redis"

export type QueueJob = { id: string; channel: NotificationChannel; priority: NotificationPriority; sendAt: Date | null }

export const MAX_ATTEMPTS = 6
const CHANNELS: NotificationChannel[] = ["inapp", "email", "telegram"]
// BullMQ: lower number = higher priority. One queue per channel (AR-3); priority
// is the lane, so a digest can't be taken before a queued password reset (NT-3).
const PRIORITY: Record<NotificationPriority, number> = { high: 1, normal: 5, low: 10 }

@Injectable()
export class NotificationsQueue implements OnModuleDestroy {
  private readonly log = new Logger("NotificationsQueue")
  private readonly queues = new Map<NotificationChannel, Queue>()
  private readonly workers: Worker[] = []

  constructor(
    private readonly redis: NotificationsRedis,
    private readonly processor: DeliveryProcessor,
  ) {}

  private queue(channel: NotificationChannel): Queue {
    let q = this.queues.get(channel)
    if (!q) {
      q = new Queue(`notif-${channel}`, { connection: this.redis.connection() })
      this.queues.set(channel, q)
    }
    return q
  }

  // jobId = delivery id: BullMQ ignores a second add with the same id, which is
  // what makes enqueue and reconcile safe to repeat.
  async add(job: QueueJob, now = new Date()): Promise<void> {
    const delay = job.sendAt ? Math.max(0, job.sendAt.getTime() - now.getTime()) : 0
    await this.queue(job.channel).add(
      "deliver",
      { deliveryId: job.id },
      {
        jobId: job.id,
        priority: PRIORITY[job.priority],
        delay,
        attempts: MAX_ATTEMPTS,
        backoff: { type: "custom" },
        removeOnComplete: true,
        removeOnFail: { age: 30 * 86_400 },
      },
    )
  }

  // Frees the job id so a replayed delivery can be enqueued again.
  async remove(ids: { id: string; channel: NotificationChannel }[]): Promise<void> {
    await Promise.all(ids.map(({ id, channel }) => this.queue(channel).remove(id).catch(() => 0)))
  }

  startWorkers(): void {
    for (const channel of CHANNELS) {
      const worker = new Worker(`notif-${channel}`, (job: Job<{ deliveryId: string }>) => this.handle(job), {
        connection: this.redis.connection(),
        concurrency: 5,
        // Telegram's overall cap is ~30 messages/second; stay under it (TG-6).
        ...(channel === "telegram" ? { limiter: { max: 25, duration: 1000 } } : {}),
        settings: {
          backoffStrategy: (attemptsMade: number, _type?: string, err?: Error) =>
            backoffDelay(attemptsMade, (err as RetryableError | undefined)?.retryAfterMs),
        },
      })
      worker.on("error", (err) => this.log.error(`worker ${channel}: ${err.message}`))
      this.workers.push(worker)
    }
  }

  private async handle(job: Job<{ deliveryId: string }>): Promise<void> {
    const outcome = await this.processor.process(job.data.deliveryId, {
      made: job.attemptsMade + 1,
      max: job.opts.attempts ?? 1,
    })
    if (outcome.kind === "retry") {
      throw Object.assign(new Error(outcome.code), { retryAfterMs: outcome.retryAfterMs })
    }
    if (outcome.kind === "exhausted") throw new UnrecoverableError(outcome.code) // lands in the failed set
  }

  // RL-7: stop taking jobs and let in-flight ones finish.
  async onModuleDestroy() {
    await Promise.all(this.workers.map((w) => w.close()))
    await Promise.all([...this.queues.values()].map((q) => q.close()))
  }
}
