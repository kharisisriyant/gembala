import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ApiError } from "@/lib/api"
import { useRespondRoster, useRosterResponse } from "@/lib/queries"

// Opened from the link a leader shares (email, WhatsApp); works without signing in.
export function RosterRespondPage() {
  const { t, i18n } = useTranslation("roster")
  const token = useSearchParams()[0].get("token") ?? ""
  const view = useRosterResponse(token)
  const respond = useRespondRoster(token)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState("")
  const data = view.data

  const date = data
    ? new Date(`${data.date}T00:00:00Z`).toLocaleDateString(i18n.language.startsWith("id") ? "id-ID" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : ""

  const submit = (status: "confirmed" | "declined") =>
    respond.mutate(
      { status, reason: status === "declined" ? reason : undefined },
      { onSuccess: () => setDeclining(false) },
    )

  const respondError =
    respond.error instanceof ApiError && respond.error.status === 409
      ? t("closed")
      : respond.error instanceof ApiError && respond.error.status === 429
        ? t("tooMany")
        : t("error")

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center p-4">
      <Card className="w-full space-y-4 p-6">
        {view.isLoading ? null : !data ? (
          <>
            <h1 className="text-2xl">{t("title")}</h1>
            <p role="alert">{view.error instanceof ApiError && view.error.status === 429 ? t("tooMany") : t("invalid")}</p>
          </>
        ) : (
          <>
            <div>
              <p className="text-muted-foreground text-sm">{data.churchName}</p>
              <h1 className="text-2xl">{t("greeting", { name: data.memberName })}</h1>
            </div>
            <p>{t("scheduled", { role: data.roleName, service: data.serviceName, date })}</p>
            {data.theme && <p className="text-muted-foreground text-sm">{t("theme", { theme: data.theme })}</p>}

            <p role="status" className="font-medium">
              {data.status === "confirmed"
                ? t("status.confirmed")
                : data.status === "declined"
                  ? t("status.declined")
                  : t("status.pending")}
            </p>
            {data.status === "declined" && data.declineReason && (
              <p className="text-muted-foreground text-sm">{t("yourReason", { reason: data.declineReason })}</p>
            )}

            {!data.open ? (
              <p className="text-muted-foreground text-sm">{t("closed")}</p>
            ) : declining ? (
              <div className="space-y-3">
                <div className="grid gap-2">
                  <Label htmlFor="decline-reason">{t("reasonLabel")}</Label>
                  <Textarea
                    id="decline-reason"
                    maxLength={500}
                    placeholder={t("reasonPlaceholder")}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" disabled={respond.isPending} onClick={() => submit("declined")}>
                    {t("sendDecline")}
                  </Button>
                  <Button variant="outline" disabled={respond.isPending} onClick={() => setDeclining(false)}>
                    {t("common:actions.cancel")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {data.status !== "pending" && <p className="text-muted-foreground text-sm">{t("canChange")}</p>}
                <div className="flex gap-2">
                  <Button disabled={respond.isPending || data.status === "confirmed"} onClick={() => submit("confirmed")}>
                    {t("confirm")}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={respond.isPending}
                    onClick={() => {
                      setReason(data.declineReason)
                      setDeclining(true)
                    }}
                  >
                    {data.status === "declined" ? t("editDecline") : t("decline")}
                  </Button>
                </div>
              </>
            )}
            {respond.isError && <p role="alert" className="text-destructive text-sm">{respondError}</p>}
          </>
        )}
      </Card>
    </div>
  )
}
