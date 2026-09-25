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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCreateRoom } from "@/lib/queries"

export function AddRoomDialog() {
  const { t } = useTranslation("rooms")
  const createRoom = useCreateRoom()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [capacity, setCapacity] = useState("")
  const [description, setDescription] = useState("")

  const save = async () => {
    try {
      await createRoom.mutateAsync({
        name,
        capacity: capacity ? Number(capacity) : null,
        description,
        isActive: true,
      })
      toast.success(t("add.success", { name }))
      setName("")
      setCapacity("")
      setDescription("")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("add.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t("add.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="room-name">{t("add.nameLabel")}</Label>
            <Input
              id="room-name"
              placeholder={t("add.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="room-capacity">{t("add.capacityLabel")}</Label>
            <Input
              id="room-capacity"
              type="number"
              min={1}
              placeholder={t("add.capacityPlaceholder")}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="room-description">{t("add.descriptionLabel")}</Label>
            <Textarea
              id="room-description"
              placeholder={t("add.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || createRoom.isPending}>
            {createRoom.isPending ? t("add.adding") : t("add.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
