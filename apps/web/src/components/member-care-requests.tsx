import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CareRequestDialog } from "@/components/care-request-dialog"
import { CareRequestActions } from "@/components/care-request-actions"
import { CareRequestStatusBadge, CareRequestTypeBadge } from "@/components/care-request-badges"
import { useAuth } from "@/lib/auth"
import { useCareRequests } from "@/lib/queries"
import { formatDate } from "@/lib/helpers"

// "Requests" section of the member detail sheet.
export function MemberCareRequests({ memberId }: { memberId: string }) {
  const { t } = useTranslation("care-requests")
  const { hasPermission } = useAuth()
  const canRead = hasPermission("care_requests", "read")
  const canCreate = hasPermission("care_requests", "create")
  const { data: requests = [] } = useCareRequests({ memberId }, canRead)

  if (!canRead) return null

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-muted-foreground text-xs font-medium uppercase">{t("memberSection.title")}</div>
        {canCreate && (
          <CareRequestDialog
            memberId={memberId}
            trigger={
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                <Plus className="size-3.5" /> {t("memberSection.add")}
              </Button>
            }
          />
        )}
      </div>
      <div className="space-y-2">
        {requests.map((r) => (
          <div key={r.id} className="rounded-md border p-2 text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CareRequestTypeBadge type={r.type} />
                <CareRequestStatusBadge status={r.status} />
              </div>
              <CareRequestActions request={r} />
            </div>
            <div className="whitespace-pre-wrap">{r.body}</div>
            {r.closeNote && (
              <div className="text-muted-foreground mt-1 text-xs">
                {t("closeNotePrefix")} {r.closeNote}
              </div>
            )}
            <div className="text-muted-foreground mt-1 text-xs">
              {formatDate(r.createdAt.slice(0, 10))}
              {r.submittedBy ? ` · ${r.submittedBy.name}` : ""}
            </div>
          </div>
        ))}
        {requests.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("memberSection.empty")}</p>
        )}
      </div>
    </div>
  )
}
