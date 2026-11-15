import { useEffect, useState } from "react"
import { CalendarSync, CheckCircle2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/page-header"
import {
  useConnectGoogleCalendar,
  useDisconnectGoogleCalendar,
  useGoogleCalendar,
  useSyncGoogleCalendar,
  useUpdateGoogleCalendar,
} from "@/lib/queries"

export function GoogleCalendarPage() {
  const { t } = useTranslation(["google", "common"])
  const { data, isLoading } = useGoogleCalendar()
  const connect = useConnectGoogleCalendar()
  const update = useUpdateGoogleCalendar()
  const sync = useSyncGoogleCalendar()
  const disconnect = useDisconnectGoogleCalendar()
  const [confirming, setConfirming] = useState(false)
  const [params, setParams] = useSearchParams()
  const result = params.get("result")

  // The API's OAuth callback redirects here with ?result=connected|error.
  useEffect(() => {
    if (!result) return
    if (result === "connected") toast.success(t("connectedToast"), { id: "google-calendar-result" })
    else toast.error(t("connectError"), { id: "google-calendar-result" })
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete("result")
        return next
      },
      { replace: true },
    )
  }, [result, setParams, t])

  const startConnect = async () => {
    try {
      const { url } = await connect.mutateAsync()
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("connectError"))
    }
  }

  const setFeed = (input: { syncEvents: boolean } | { syncRooms: boolean }) =>
    update.mutate(input, {
      onError: (err) => toast.error(err instanceof Error ? err.message : t("updateError")),
    })

  const syncNow = async () => {
    try {
      const status = await sync.mutateAsync()
      if (status.lastError) toast.error(t("syncFailed", { error: status.lastError }))
      else toast.success(t("synced"))
    } catch (err) {
      toast.error(t("syncFailed", { error: err instanceof Error ? err.message : "" }))
    }
  }

  const doDisconnect = async () => {
    try {
      await disconnect.mutateAsync()
      setConfirming(false)
      toast(t("disconnected"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("updateError"))
    }
  }

  const connectLabel = connect.isPending ? t("connecting") : t("connect")

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <Card className="max-w-lg p-6">
        {isLoading || !data ? (
          <p className="text-muted-foreground text-sm">{t("loading")}</p>
        ) : !data.configured ? (
          <p className="text-muted-foreground text-sm">{t("notConfigured")}</p>
        ) : !data.connected ? (
          <div>
            <div className="flex items-start gap-4">
              <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <CalendarSync className="size-5" />
              </div>
              <div className="flex-1">
                <h2 className="font-medium">{t("connectTitle")}</h2>
                <p className="text-muted-foreground mt-0.5 text-sm">{t("connectBody")}</p>
              </div>
            </div>
            <Button className="mt-5" disabled={connect.isPending} onClick={startConnect}>
              <CalendarSync className="size-4" /> {connectLabel}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">
                <CheckCircle2 className="size-3.5" /> {t("connected")}
              </Badge>
              {data.googleEmail && <span className="text-muted-foreground text-sm">{data.googleEmail}</span>}
            </div>

            {data.lastError && (
              <div role="alert" className="border-destructive/40 bg-destructive/5 rounded-lg border p-4">
                <p className="text-destructive text-sm font-medium">{t("errorTitle")}</p>
                <p className="text-destructive mt-1 text-sm">{data.lastError}</p>
                <Button variant="outline" size="sm" className="mt-3" disabled={connect.isPending} onClick={startConnect}>
                  {connect.isPending ? t("connecting") : t("reconnect")}
                </Button>
              </div>
            )}

            <div>
              <h2 className="font-medium">{t("feedsTitle")}</h2>
              <p className="text-muted-foreground mt-0.5 text-sm">{t("feedsHint")}</p>
              <div className="mt-3 space-y-3">
                <label className="flex items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={data.syncEvents}
                    disabled={update.isPending}
                    onCheckedChange={(checked) => setFeed({ syncEvents: checked === true })}
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("events")}</span>
                    <span className="text-muted-foreground block text-sm">{t("eventsHint")}</span>
                  </span>
                </label>
                <label className="flex items-start gap-3">
                  <Checkbox
                    className="mt-0.5"
                    checked={data.syncRooms}
                    disabled={update.isPending}
                    onCheckedChange={(checked) => setFeed({ syncRooms: checked === true })}
                  />
                  <span>
                    <span className="block text-sm font-medium">{t("rooms")}</span>
                    <span className="text-muted-foreground block text-sm">{t("roomsHint")}</span>
                  </span>
                </label>
              </div>
              <p className="text-muted-foreground mt-3 text-xs">{t("turnOffHint")}</p>
              <p className="text-muted-foreground mt-1 text-xs">{t("oneWay")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={sync.isPending || !(data.syncEvents || data.syncRooms)}
                onClick={syncNow}
              >
                {sync.isPending ? t("syncing") : t("syncNow")}
              </Button>
              <span className="text-muted-foreground text-xs">
                {data.lastSyncedAt ? t("lastSynced", { time: new Date(data.lastSyncedAt).toLocaleString() }) : t("neverSynced")}
              </span>
            </div>

            <div className="border-t pt-4">
              {confirming ? (
                <div className="space-y-3">
                  <p className="text-sm">{t("disconnectConfirm")}</p>
                  <div className="flex gap-2">
                    <Button variant="destructive" size="sm" disabled={disconnect.isPending} onClick={doDisconnect}>
                      {t("disconnectYes")}
                    </Button>
                    <Button variant="outline" size="sm" disabled={disconnect.isPending} onClick={() => setConfirming(false)}>
                      {t("common:actions.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
                  {t("disconnect")}
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
