import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import type { EventResponse } from "@gembala/shared"
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
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useRooms, useUpdateEvent } from "@/lib/queries"
import { toLocalInputValue } from "@/lib/helpers"

const NO_ROOM = "none"

export function EditEventDialog({
  event,
  trigger,
}: {
  event: EventResponse
  trigger: React.ReactNode
}) {
  const { t } = useTranslation("events")
  const { data: rooms = [] } = useRooms()
  const updateEvent = useUpdateEvent()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(event.title)
  const [description, setDescription] = useState(event.description)
  const [roomId, setRoomId] = useState(event.room?.id ?? NO_ROOM)
  const [startAt, setStartAt] = useState(toLocalInputValue(event.startAt))
  const [endAt, setEndAt] = useState(toLocalInputValue(event.endAt))
  const [isPublic, setIsPublic] = useState(event.isPublic)

  const onOpenChange = (v: boolean) => {
    if (v) {
      setTitle(event.title)
      setDescription(event.description)
      setRoomId(event.room?.id ?? NO_ROOM)
      setStartAt(toLocalInputValue(event.startAt))
      setEndAt(toLocalInputValue(event.endAt))
      setIsPublic(event.isPublic)
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      await updateEvent.mutateAsync({
        id: event.id,
        title,
        description,
        roomId: roomId === NO_ROOM ? null : roomId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isPublic,
      })
      toast.success(t("toast.updated", { title }))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.updateError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editDialog.title")}</DialogTitle>
          <DialogDescription>{t("editDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-event-title">{t("editDialog.titleLabel")}</Label>
            <Input id="edit-event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-event-start">{t("editDialog.startsLabel")}</Label>
              <Input
                id="edit-event-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-event-end">{t("editDialog.endsLabel")}</Label>
              <Input
                id="edit-event-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("editDialog.roomLabel")}</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder={t("editDialog.noRoom")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROOM}>{t("editDialog.noRoom")}</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-event-description">{t("editDialog.descriptionLabel")}</Label>
            <Textarea
              id="edit-event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={isPublic} onCheckedChange={(c) => setIsPublic(c === true)} />
            <span className="text-sm">{t("editDialog.publicLabel")}</span>
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button
            onClick={save}
            disabled={!title || !startAt || !endAt || updateEvent.isPending}
          >
            {updateEvent.isPending ? t("editDialog.saving") : t("editDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
