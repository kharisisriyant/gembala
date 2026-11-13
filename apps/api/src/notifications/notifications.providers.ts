import type { Provider } from "@nestjs/common"
import { CHANNEL_ADAPTERS } from "./notifications.adapter"
import { NOTIFICATION_CATALOG, notificationTypes } from "./notifications.catalog"
import { InAppAdapter } from "./inapp.adapter"
import { NotificationsDispatcher } from "./notifications.dispatcher"
import { DeliveryProcessor } from "./notifications.processor"
import { NotificationsQueue } from "./notifications.queue"
import { NotificationsRepository } from "./notifications.repository"
import { NotificationsRunner } from "./notifications.runner"
import { NotificationsService } from "./notifications.service"

// Everything except the cron scheduler, so e2e tests can load the pipeline
// without @nestjs/schedule (ESM-only, not loadable by the CJS Jest setup).
export const notificationProviders: Provider[] = [
  NotificationsRepository,
  NotificationsService,
  DeliveryProcessor,
  NotificationsQueue,
  NotificationsDispatcher,
  NotificationsRunner,
  InAppAdapter,
  { provide: NOTIFICATION_CATALOG, useValue: notificationTypes },
  // Channels register here as their slices land (email, telegram).
  { provide: CHANNEL_ADAPTERS, useFactory: (inapp: InAppAdapter) => [inapp], inject: [InAppAdapter] },
]
