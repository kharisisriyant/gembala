import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Check, Clock, Copy, Mail, X } from "lucide-react"
import type { RoleAssignmentResponse, RosterResponseStatus } from "@gembala/shared"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { formatDateTime } from "@/lib/helpers"
import { useNotifyRosterAssignment, useRosterLink } from "@/lib/queries"

export function ConfirmationIcon({ status, className }: { status: RosterResponseStatus; className?: string }) {
  const { t } = useTranslation("scheduling")
  const label = t(`confirmation.status.${status}`)
  const Icon = status === "confirmed" ? Check : status === "declined" ? X : Clock
  const tone = status === "confirmed" ? "text-green-600" : status === "declined" ? "text-destructive" : "text-muted-foreground"
  return (
    <span role="img" aria-label={label} title={label} className={`inline-flex shrink-0 ${className ?? ""}`}>
      <Icon aria-hidden className={`size-3 ${tone}`} />
    </span>
  )
}

const copy = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Status of the member's answer plus the two ways to ask them: copy the signed
// link (to paste into WhatsApp) or email it.
export function AssignmentConfirmation({ assignment }: { assignment: RoleAssignmentResponse }) {
  const { t, i18n } = useTranslation("scheduling")
  const link = useRosterLink()
  const notify = useNotifyRosterAssignment()
  const { status, respondedAt, declineReason, notifiedAt } = assignment.confirmation

  const copyLink = async () => {
    try {
      const { url } = await link.mutateAsync(assignment.id)
      if (await copy(url)) toast.success(t("confirmation.linkCopied"))
      else toast.message(t("confirmation.linkCopyFailed", { url }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("confirmation.error"))
    }
  }

  const send = async () => {
    try {
      const result = await notify.mutateAsync({ assignmentId: assignment.id, locale: i18n.language.startsWith("en") ? "en" : "id" })
      if (result.sentTo === "email") toast.success(t("confirmation.emailed"))
      else if (await copy(result.url)) toast.message(t("confirmation.noEmail"))
      else toast.message(t("confirmation.noEmailCopyFailed", { url: result.url }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("confirmation.error"))
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>{t("confirmation.title")}</Label>
      <p className="flex items-center gap-2 text-sm font-medium">
        <ConfirmationIcon status={status} />
        {t(`confirmation.status.${status}`)}
      </p>
      {respondedAt && <p className="text-muted-foreground text-xs">{t("confirmation.respondedAt", { when: formatDateTime(respondedAt) })}</p>}
      {status === "declined" && declineReason && <p className="text-sm">{t("confirmation.reason", { reason: declineReason })}</p>}
      {notifiedAt && <p className="text-muted-foreground text-xs">{t("confirmation.notifiedAt", { when: formatDateTime(notifiedAt) })}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" disabled={link.isPending} onClick={copyLink}>
          <Copy className="size-4" /> {t("confirmation.copyLink")}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={notify.isPending} onClick={send}>
          <Mail className="size-4" /> {notify.isPending ? t("confirmation.sending") : t("confirmation.notify")}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">{t("confirmation.hint")}</p>
    </div>
  )
}
