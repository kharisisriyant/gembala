import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { addDays, todayInZone, type CareRequestResponse, type CareRequestType } from "@gembala/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth"
import { useCareRequestAssignees, useCreateCareRequest, useMembers, useUpdateCareRequest } from "@/lib/queries"

// Create when `request` is omitted (member fixed via `memberId`, or picked in
// the form); edit type/body when `request` is given.
export function CareRequestDialog({
  request,
  memberId,
  trigger,
}: {
  request?: CareRequestResponse
  memberId?: string
  trigger: React.ReactNode
}) {
  const { t } = useTranslation("care-requests")
  const create = useCreateCareRequest()
  const update = useUpdateCareRequest()
  const { data: members = [] } = useMembers()
  const [open, setOpen] = useState(false)
  const [pickedMemberId, setPickedMemberId] = useState(memberId ?? "")
  const [type, setType] = useState<CareRequestType>(request?.type ?? "prayer")
  const [body, setBody] = useState(request?.body ?? "")
  const defaultDue = () => request?.dueAt ?? addDays(todayInZone(), 7)
  const { me } = useAuth()
  const [assignee, setAssignee] = useState(request?.assignedTo?.id ?? me?.user.id ?? "")
  const [dueAt, setDueAt] = useState(defaultDue())

  const isEdit = Boolean(request)
  const pending = create.isPending || update.isPending
  const targetMemberId = request?.memberId ?? memberId ?? pickedMemberId
  const { data: assignees = [] } = useCareRequestAssignees(open ? targetMemberId : "")

  const onOpenChange = (v: boolean) => {
    if (v) {
      setPickedMemberId(memberId ?? "")
      setType(request?.type ?? "prayer")
      setBody(request?.body ?? "")
      setAssignee(request?.assignedTo?.id ?? me?.user.id ?? "")
      setDueAt(defaultDue())
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      if (request) {
        await update.mutateAsync({ id: request.id, type, body, assignedToUserId: assignee || null, dueAt: dueAt || null })
        toast.success(t("form.updated"))
      } else {
        await create.mutateAsync({
          memberId: targetMemberId,
          type,
          body,
          assignedToUserId: assignee || undefined,
          dueAt: dueAt || undefined,
        })
        toast.success(t("form.created"))
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t(isEdit ? "form.updateError" : "form.createError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t(isEdit ? "form.editTitle" : "form.newTitle")}</DialogTitle>
          <DialogDescription>{t("form.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!isEdit && !memberId && (
            <div className="grid gap-2">
              <Label>{t("form.member")}</Label>
              <Select value={pickedMemberId} onValueChange={setPickedMemberId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("form.memberPlaceholder")} />
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
          )}
          <div className="grid gap-2">
            <Label>{t("form.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as CareRequestType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prayer">{t("type.prayer")}</SelectItem>
                <SelectItem value="care">{t("type.care")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="care-body">{t("form.body")}</Label>
            <Textarea
              id="care-body"
              rows={5}
              maxLength={2000}
              placeholder={t("form.bodyPlaceholder")}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("form.assignee")}</Label>
              <Select value={assignee} onValueChange={setAssignee} disabled={!targetMemberId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("form.assigneePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {assignees.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="care-due">{t("form.dueAt")}</Label>
              <Input id="care-due" type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!body.trim() || (!isEdit && !targetMemberId) || pending}>
            {pending ? t("common:actions.saving") : t(isEdit ? "form.saveChanges" : "form.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
