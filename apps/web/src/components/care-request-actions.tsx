import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { CheckCircle2, MoreHorizontal, Pencil, RotateCcw, Trash2 } from "lucide-react"
import type { CareRequestResponse } from "@gembala/shared"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CareRequestDialog } from "@/components/care-request-dialog"
import { CareRequestCloseDialog } from "@/components/care-request-close-dialog"
import { useAuth } from "@/lib/auth"
import { useDeleteCareRequest, useReopenCareRequest } from "@/lib/queries"

// Row menu shared by the /care-requests table and the member detail sheet.
// Renders nothing when the caller has no write access.
export function CareRequestActions({ request }: { request: CareRequestResponse }) {
  const { t } = useTranslation("care-requests")
  const { hasPermission } = useAuth()
  const canUpdate = hasPermission("care_requests", "update")
  const canDelete = hasPermission("care_requests", "delete")
  const reopen = useReopenCareRequest()
  const remove = useDeleteCareRequest()

  if (!canUpdate && !canDelete) return null

  const doReopen = async () => {
    try {
      await reopen.mutateAsync(request.id)
      toast.success(t("reopen.success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("reopen.error"))
    }
  }

  const doDelete = async () => {
    try {
      await remove.mutateAsync(request.id)
      toast(t("delete.success"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("delete.error"))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate && request.status === "open" && (
          <>
            <CareRequestDialog
              request={request}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Pencil className="size-4" /> {t("menu.edit")}
                </DropdownMenuItem>
              }
            />
            <CareRequestCloseDialog
              request={request}
              trigger={
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <CheckCircle2 className="size-4" /> {t("menu.close")}
                </DropdownMenuItem>
              }
            />
          </>
        )}
        {canUpdate && request.status === "closed" && (
          <DropdownMenuItem onClick={doReopen}>
            <RotateCcw className="size-4" /> {t("menu.reopen")}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <DropdownMenuItem variant="destructive" onClick={doDelete}>
            <Trash2 className="size-4" /> {t("menu.delete")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
