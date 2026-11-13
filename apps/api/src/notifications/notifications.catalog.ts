import type { z } from "zod"
import type { NotificationCategory, NotificationChannel, NotificationPriority } from "@gembala/shared"

export type NotificationLocale = "en" | "id"

export type RenderedContent = {
  title: string
  body: string
  // Path relative to the web app (e.g. "/care/123"); joined to WEB_ORIGIN, never a free-form URL.
  link: string | null
}

// One registered notification type (NT-1). Producers pass a key; the catalog and
// the user's preferences decide channels (NT-2). `payload` is validated at
// notify() time, so bad events are rejected before they are stored (TP-1).
export type NotificationType<P = any> = {
  key: string
  category: NotificationCategory
  priority: NotificationPriority
  // In-app is always added by the router (IA-1); list only the reach channels.
  defaultChannels: NotificationChannel[]
  ttlMs: number
  payload: z.ZodType<P>
  render: (locale: NotificationLocale, payload: P) => RenderedContent
}

export const NOTIFICATION_CATALOG = Symbol("NOTIFICATION_CATALOG")

// Types register here as producers adopt the pipeline.
export const notificationTypes: NotificationType[] = []

export function catalogByKey(types: readonly NotificationType[]): Map<string, NotificationType> {
  const map = new Map<string, NotificationType>()
  for (const type of types) {
    if (map.has(type.key)) throw new Error(`Duplicate notification type: ${type.key}`)
    map.set(type.key, type)
  }
  return map
}
