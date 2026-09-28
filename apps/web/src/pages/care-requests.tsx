import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import type { CareRequestStatus, CareRequestType } from "@gembala/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { CareRequestDialog } from "@/components/care-request-dialog"
import { CareRequestActions } from "@/components/care-request-actions"
import { CareRequestStatusBadge, CareRequestTypeBadge } from "@/components/care-request-badges"
import { useAuth } from "@/lib/auth"
import { useCareRequests } from "@/lib/queries"
import { formatDate } from "@/lib/helpers"

const ALL = "all"

export function CareRequestsPage() {
  const { t } = useTranslation("care-requests")
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("care_requests", "create")
  const canManage = hasPermission("care_requests", "update") || hasPermission("care_requests", "delete")
  const [status, setStatus] = useState<CareRequestStatus | typeof ALL>("open")
  const [type, setType] = useState<CareRequestType | typeof ALL>(ALL)
  const { data: requests = [], isLoading } = useCareRequests({
    status: status === ALL ? undefined : status,
    type: type === ALL ? undefined : type,
  })

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          canCreate ? (
            <CareRequestDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> {t("newRequest")}
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as CareRequestStatus | typeof ALL)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allStatuses")}</SelectItem>
            <SelectItem value="open">{t("status.open")}</SelectItem>
            <SelectItem value="closed">{t("status.closed")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => setType(v as CareRequestType | typeof ALL)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("filters.allTypes")}</SelectItem>
            <SelectItem value="prayer">{t("type.prayer")}</SelectItem>
            <SelectItem value="care">{t("type.care")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.member")}</TableHead>
                <TableHead>{t("table.type")}</TableHead>
                <TableHead>{t("table.request")}</TableHead>
                <TableHead>{t("table.status")}</TableHead>
                <TableHead>{t("table.submitted")}</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.memberName}</TableCell>
                  <TableCell>
                    <CareRequestTypeBadge type={r.type} />
                  </TableCell>
                  <TableCell className="max-w-sm whitespace-normal">
                    <div className="whitespace-pre-wrap">{r.body}</div>
                    {r.closeNote && (
                      <div className="text-muted-foreground mt-1 text-xs">
                        {t("closeNotePrefix")} {r.closeNote}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <CareRequestStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm whitespace-normal">
                    <div>{formatDate(r.createdAt.slice(0, 10))}</div>
                    {r.submittedBy && <div className="text-xs">{r.submittedBy.name}</div>}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <CareRequestActions request={r} />
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && requests.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">{t("empty")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
