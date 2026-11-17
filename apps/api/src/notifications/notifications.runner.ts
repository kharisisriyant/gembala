import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { NotificationsDispatcher } from "./notifications.dispatcher"
import { NotificationsQueue } from "./notifications.queue"
import { NotificationsService } from "./notifications.service"

const TICK_MS = 1_000
const RECONCILE_EVERY_MS = 60_000

// Runs the relay, reconciler and workers inside the API process when
// NOTIFICATIONS_WORKERS=true (D31). Instances without the flag only write
// outbox rows. Several runners at once are safe: claims use SKIP LOCKED.
@Injectable()
export class NotificationsRunner implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger("NotificationsRunner")
  private timer?: NodeJS.Timeout
  private inFlight: Promise<void> = Promise.resolve()
  private busy = false
  private lastReconcile = 0

  constructor(
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly dispatcher: NotificationsDispatcher,
    private readonly queue: NotificationsQueue,
  ) {}

  get enabled(): boolean {
    return this.config.get<boolean>("NOTIFICATIONS_WORKERS") === true
  }

  onModuleInit() {
    if (!this.enabled) return
    this.queue.startWorkers()
    this.timer = setInterval(() => {
      if (this.busy) return
      this.busy = true
      this.inFlight = this.tick().finally(() => (this.busy = false))
    }, TICK_MS)
  }

  async tick(now = Date.now()): Promise<void> {
    try {
      await this.notifications.routePending()
      await this.dispatcher.enqueuePending()
      if (now - this.lastReconcile >= RECONCILE_EVERY_MS) {
        this.lastReconcile = now
        await this.dispatcher.reconcile(new Date(now))
      }
    } catch (err) {
      this.log.error(`tick failed: ${(err as Error).message}`)
    }
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
    await this.inFlight
  }
}
