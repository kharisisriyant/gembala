import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import type { RoleAssignmentResponse } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { AssignmentDialog } from "./assignment-dialog"

export function AssignmentCell({
  instanceId,
  roleTemplateId,
  roleName,
  instanceName,
  assignments,
  canManage,
}: {
  instanceId: string
  roleTemplateId: string
  roleName: string
  instanceName: string
  assignments: RoleAssignmentResponse[]
  canManage: boolean
}) {
  const { t } = useTranslation("scheduling")
  const [editing, setEditing] = useState<RoleAssignmentResponse | "new" | null>(null)

  const label = (a: RoleAssignmentResponse) => a.member?.name ?? a.freeText

  return (
    <div className="flex flex-wrap items-center gap-1">
      {assignments.length === 0 && !canManage && (
        <span className="text-muted-foreground">{t("assignment.empty")}</span>
      )}
      {assignments.map((a) => (
        <Badge
          key={a.id}
          variant="muted"
          className={canManage ? "cursor-pointer" : undefined}
          onClick={canManage ? () => setEditing(a) : undefined}
        >
          {label(a)}
        </Badge>
      ))}
      {canManage && (
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          onClick={() => setEditing("new")}
        >
          <Plus className="size-3.5" />
        </Button>
      )}
      {editing && (
        <AssignmentDialog
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
          instanceId={instanceId}
          roleTemplateId={roleTemplateId}
          roleName={roleName}
          instanceName={instanceName}
          assignment={editing === "new" ? undefined : editing}
          sortOrder={editing === "new" ? assignments.length : editing.sortOrder}
        />
      )}
    </div>
  )
}
