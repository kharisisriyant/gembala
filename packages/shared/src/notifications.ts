export const NOTIFICATION_CHANNELS = ["inapp", "email", "telegram"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_CATEGORIES = ["security", "transactional", "activity", "reminder", "product_updates"] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const NOTIFICATION_PRIORITIES = ["high", "normal", "low"] as const
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number]

export const DELIVERY_STATUSES = ["pending", "queued", "sent", "delivered", "failed", "skipped"] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const SKIP_REASONS = ["preference", "not_connected", "expired", "suppressed", "no_access", "kill_switch"] as const
export type SkipReason = (typeof SKIP_REASONS)[number]

// Default on/off per category x channel (requirements section 5). `locked`
// cells cannot be changed by the user. In-app is always on: the inbox is the
// record of everything sent (IA-1).
export const NOTIFICATION_DEFAULTS: Record<NotificationCategory, Record<NotificationChannel, { enabled: boolean; locked: boolean }>> = {
  security: { inapp: { enabled: true, locked: true }, email: { enabled: true, locked: true }, telegram: { enabled: true, locked: false } },
  transactional: { inapp: { enabled: true, locked: true }, email: { enabled: true, locked: false }, telegram: { enabled: true, locked: false } },
  activity: { inapp: { enabled: true, locked: true }, email: { enabled: false, locked: false }, telegram: { enabled: true, locked: false } },
  reminder: { inapp: { enabled: true, locked: true }, email: { enabled: true, locked: false }, telegram: { enabled: true, locked: false } },
  product_updates: { inapp: { enabled: true, locked: true }, email: { enabled: false, locked: false }, telegram: { enabled: false, locked: false } },
}

export function channelEnabled(
  category: NotificationCategory,
  channel: NotificationChannel,
  overrides: ReadonlyArray<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }>,
): boolean {
  const base = NOTIFICATION_DEFAULTS[category][channel]
  if (base.locked) return base.enabled
  const override = overrides.find((o) => o.category === category && o.channel === channel)
  return override ? override.enabled : base.enabled
}
