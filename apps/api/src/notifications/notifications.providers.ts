import type { Provider } from "@nestjs/common"
import { CHANNEL_ADAPTERS } from "./notifications.adapter"
import { NOTIFICATION_CATALOG, notificationTypes } from "./notifications.catalog"
import { EmailAdapter } from "./email.adapter"
import { EndpointsRepository } from "./endpoints.repository"
import { PreferencesRepository } from "./preferences.repository"
import { TelegramAdapter } from "./telegram.adapter"
import { InAppAdapter } from "./inapp.adapter"
import { NotificationsDispatcher } from "./notifications.dispatcher"
import { DeliveryProcessor } from "./notifications.processor"
import { NotificationAccess } from "./notifications.access"
import { NotificationsRedis } from "./notifications.redis"
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
  NotificationsRedis,
  NotificationAccess,
  NotificationsQueue,
  NotificationsDispatcher,
  NotificationsRunner,
  InAppAdapter,
  EmailAdapter,
  TelegramAdapter,
  EndpointsRepository,
  PreferencesRepository,
  { provide: NOTIFICATION_CATALOG, useValue: notificationTypes },
  {
    provide: CHANNEL_ADAPTERS,
    useFactory: (inapp: InAppAdapter, email: EmailAdapter, telegram: TelegramAdapter) => [inapp, email, telegram],
    inject: [InAppAdapter, EmailAdapter, TelegramAdapter],
  },
]
