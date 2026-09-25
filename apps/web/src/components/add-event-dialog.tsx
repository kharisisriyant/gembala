import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
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
import { useCreateEvent, useRooms } from "@/lib/queries"

const NO_ROOM = "none"

export function AddEventDialog() {
  const { t } = useTranslation("events")
  const { data: rooms = [] } = useRooms()
  const createEvent = useCreateEvent()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [roomId, setRoomId] = useState(NO_ROOM)
  const [startAt, setStartAt] = useState("")
  const [endAt, setEndAt] = useState("")
  const [isPublic, setIsPublic] = useState(false)

  const reset = () => {
    setTitle("")
    setDescription("")
    setRoomId(NO_ROOM)
    setStartAt("")
    setEndAt("")
    setIsPublic(false)
  }

  const save = async () => {
    try {
      await createEvent.mutateAsync({
        title,
        description,
        roomId: roomId === NO_ROOM ? null : roomId,
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        isPublic,
      })
      toast.success(t("toast.created", { title }))
      reset()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.createError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t("addDialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addDialog.title")}</DialogTitle>
          <DialogDescription>{t("addDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid gap-2">
            <Label htmlFor="event-title">{t("addDialog.titleLabel")}</Label>
            <Input
              id="event-title"
              placeholder={t("addDialog.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="event-start">{t("addDialog.startsLabel")}</Label>
              <Input
                id="event-start"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="event-end">{t("addDialog.endsLabel")}</Label>
              <Input
                id="event-end"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("addDialog.roomLabel")}</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder={t("addDialog.noRoom")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROOM}>{t("addDialog.noRoom")}</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="event-description">{t("addDialog.descriptionLabel")}</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={isPublic} onCheckedChange={(c) => setIsPublic(c === true)} />
            <span className="text-sm">{t("addDialog.publicLabel")}</span>
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button
            onClick={save}
            disabled={!title || !startAt || !endAt || createEvent.isPending}
          >
            {createEvent.isPending ? t("addDialog.creating") : t("addDialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
