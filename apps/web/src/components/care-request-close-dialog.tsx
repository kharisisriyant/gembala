import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { CareRequestResponse } from "@gembala/shared"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCloseCareRequest } from "@/lib/queries"

export function CareRequestCloseDialog({
  request,
  trigger,
}: {
  request: CareRequestResponse
  trigger: React.ReactNode
}) {
  const { t } = useTranslation("care-requests")
  const close = useCloseCareRequest()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")

  const onOpenChange = (v: boolean) => {
    if (v) setNote("")
    setOpen(v)
  }

  const save = async () => {
    try {
      await close.mutateAsync({ id: request.id, note: note.trim() || undefined })
      toast.success(t("close.success"))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("close.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("close.title")}</DialogTitle>
          <DialogDescription>{t("close.description", { name: request.memberName })}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="care-close-note">{t("close.noteLabel")}</Label>
          <Textarea
            id="care-close-note"
            rows={3}
            maxLength={2000}
            placeholder={t("close.notePlaceholder")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={close.isPending}>
            {close.isPending ? t("common:actions.saving") : t("close.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
