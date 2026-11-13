import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { toast } from "sonner"
import { NOTIFICATION_CHANNELS, type NotificationCategory, type NotificationChannel } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useNotificationPreferences, useUpdateNotificationPreference } from "@/lib/queries"

// Category x channel grid (PR-2, PR-3). Locked cells are visible but disabled, with the reason.
export function NotificationPreferences() {
  const { t } = useTranslation("notifications")
  const { data, isLoading } = useNotificationPreferences()
  const update = useUpdateNotificationPreference()
  if (isLoading || !data) return null

  const lockedReason = (category: NotificationCategory, channel: NotificationChannel) =>
    channel === "inapp" ? t("preferences.locked.inapp") : category === "security" ? t("preferences.locked.security") : t("preferences.locked.default")

  const state = (channel: NotificationChannel) => {
    if (channel === "telegram") return data.channels.telegram.state
    if (channel === "email") return data.channels.email.state === "bounced" ? "disconnected" : "connected"
    return "connected"
  }

  return (
    <Card className="max-w-3xl space-y-4 p-6">
      <div>
        <h2 className="text-lg font-medium">{t("preferences.title")}</h2>
        <p className="text-muted-foreground text-sm">{t("preferences.subtitle")}</p>
      </div>
      {data.channels.email.state === "bounced" && (
        <p role="alert" className="text-destructive text-sm">
          {t("preferences.emailBounced", { address: data.channels.email.address })}
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("preferences.category")}</TableHead>
            {NOTIFICATION_CHANNELS.map((channel) => (
              <TableHead key={channel} className="text-center">
                <div>{t(`preferences.channels.${channel}`)}</div>
                {state(channel) !== "connected" && (
                  <div className="mt-1 flex flex-col items-center gap-1">
                    <Badge variant="outline">
                      {state(channel) === "disconnected" ? t("preferences.disconnected") : t("preferences.notConnected")}
                    </Badge>
                    {channel === "telegram" && (
                      <Button asChild variant="link" size="sm" className="h-auto p-0">
                        <Link to="/telegram">{state(channel) === "disconnected" ? t("preferences.reconnect") : t("preferences.connect")}</Link>
                      </Button>
                    )}
                  </div>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.categories.map(({ category, cells }) => (
            <TableRow key={category}>
              <TableCell className="font-medium">{t(`preferences.categories.${category}`)}</TableCell>
              {NOTIFICATION_CHANNELS.map((channel) => {
                const cell = cells[channel]
                const label = `${t(`preferences.categories.${category}`)} · ${t(`preferences.channels.${channel}`)}`
                return (
                  <TableCell key={channel} className="text-center">
                    <Checkbox
                      aria-label={label}
                      checked={cell.enabled}
                      disabled={cell.locked || update.isPending}
                      title={cell.locked ? lockedReason(category, channel) : undefined}
                      onCheckedChange={(checked) =>
                        update.mutate(
                          { category, channel, enabled: checked === true },
                          { onSuccess: () => toast(t("preferences.saved")) },
                        )
                      }
                    />
                    {cell.locked && <span className="sr-only">{lockedReason(category, channel)}</span>}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-muted-foreground text-xs">{t("preferences.telegramNote")}</p>
    </Card>
  )
}
