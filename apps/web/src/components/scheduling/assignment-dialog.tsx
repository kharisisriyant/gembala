import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { RoleAssignmentResponse } from "@gembala/shared"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  useCreateRoleAssignment,
  useDeleteRoleAssignment,
  useMembers,
  useUpdateRoleAssignment,
} from "@/lib/queries"

type Mode = "member" | "text"

export function AssignmentDialog({
  open,
  onOpenChange,
  instanceId,
  roleTemplateId,
  roleName,
  instanceName,
  assignment,
  sortOrder,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  instanceId: string
  roleTemplateId: string
  roleName: string
  instanceName: string
  assignment?: RoleAssignmentResponse
  sortOrder: number
}) {
  const { t } = useTranslation("scheduling")
  const { data: members = [] } = useMembers()
  const createAssignment = useCreateRoleAssignment()
  const updateAssignment = useUpdateRoleAssignment()
  const deleteAssignment = useDeleteRoleAssignment()

  const [mode, setMode] = useState<Mode>(assignment?.member ? "member" : "text")
  const [memberId, setMemberId] = useState(assignment?.member?.id ?? "")
  const [freeText, setFreeText] = useState(assignment?.freeText ?? "")

  const onDialogOpenChange = (v: boolean) => {
    if (v) {
      setMode(assignment?.member ? "member" : "text")
      setMemberId(assignment?.member?.id ?? "")
      setFreeText(assignment?.freeText ?? "")
    }
    onOpenChange(v)
  }

  const save = async () => {
    try {
      const input = {
        roleTemplateId,
        memberId: mode === "member" ? memberId : null,
        freeText: mode === "text" ? freeText : "",
        sortOrder,
      }
      if (assignment) {
        await updateAssignment.mutateAsync({ assignmentId: assignment.id, ...input })
      } else {
        await createAssignment.mutateAsync({ instanceId, ...input })
      }
      toast.success(t("toast.assignmentSaved"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.assignmentError"))
    }
  }

  const remove = async () => {
    if (!assignment) return
    try {
      await deleteAssignment.mutateAsync(assignment.id)
      toast.success(t("toast.assignmentRemoved"))
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.assignmentError"))
    }
  }

  const saving = createAssignment.isPending || updateAssignment.isPending
  const canSave = mode === "member" ? Boolean(memberId) : freeText.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onDialogOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("assignmentDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("assignmentDialog.description", { role: roleName, instance: instanceName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>{t("assignmentDialog.modeLabel")}</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t("assignmentDialog.modeMember")}</SelectItem>
                <SelectItem value="text">{t("assignmentDialog.modeText")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {mode === "member" ? (
            <div className="grid gap-2">
              <Label>{t("assignmentDialog.memberLabel")}</Label>
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("assignmentDialog.memberPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="assignment-free-text">{t("assignmentDialog.textLabel")}</Label>
              <Input
                id="assignment-free-text"
                placeholder={t("assignmentDialog.textPlaceholder")}
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
              />
            </div>
          )}
        </div>
        <DialogFooter className="sm:justify-between">
          {assignment ? (
            <Button variant="ghost" className="text-destructive" onClick={remove}>
              {t("assignmentDialog.remove")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">{t("common:actions.cancel")}</Button>
            </DialogClose>
            <Button onClick={save} disabled={!canSave || saving}>
              {saving ? t("assignmentDialog.saving") : t("assignmentDialog.saveChanges")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
