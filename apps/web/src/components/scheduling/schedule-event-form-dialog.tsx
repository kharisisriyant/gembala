import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import type { ScheduleEventDetailResponse } from "@gembala/shared"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCreateScheduleEvent, useUpdateScheduleEvent } from "@/lib/queries"

export function ScheduleEventFormDialog({
  event,
  trigger,
}: {
  event?: ScheduleEventDetailResponse
  trigger?: React.ReactNode
}) {
  const { t } = useTranslation("scheduling")
  const createEvent = useCreateScheduleEvent()
  const updateEvent = useUpdateScheduleEvent()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(event?.date ?? "")
  const [scriptureRef, setScriptureRef] = useState(event?.scriptureRef ?? "")
  const [theme, setTheme] = useState(event?.theme ?? "")

  const onOpenChange = (v: boolean) => {
    if (v) {
      setDate(event?.date ?? "")
      setScriptureRef(event?.scriptureRef ?? "")
      setTheme(event?.theme ?? "")
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      if (event) {
        await updateEvent.mutateAsync({ id: event.id, date, scriptureRef, theme })
        toast.success(t("toast.eventUpdated"))
      } else {
        await createEvent.mutateAsync({ date, scriptureRef, theme })
        toast.success(t("toast.eventCreated"))
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.eventError"))
    }
  }

  const saving = createEvent.isPending || updateEvent.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> {t("addEventDialog.trigger")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? t("editEventDialog.title") : t("addEventDialog.title")}</DialogTitle>
          <DialogDescription>
            {event ? t("editEventDialog.description") : t("addEventDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="schedule-event-date">{t("addEventDialog.dateLabel")}</Label>
            <Input
              id="schedule-event-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-event-scripture">{t("addEventDialog.scriptureLabel")}</Label>
            <Input
              id="schedule-event-scripture"
              placeholder={t("addEventDialog.scripturePlaceholder")}
              value={scriptureRef}
              onChange={(e) => setScriptureRef(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="schedule-event-theme">{t("addEventDialog.themeLabel")}</Label>
            <Textarea
              id="schedule-event-theme"
              placeholder={t("addEventDialog.themePlaceholder")}
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!date || saving}>
            {saving
              ? t("addEventDialog.creating")
              : event
                ? t("editEventDialog.saveChanges")
                : t("addEventDialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
