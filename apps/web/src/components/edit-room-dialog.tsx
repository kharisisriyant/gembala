import { useState } from "react"
import { toast } from "sonner"
import type { RoomResponse } from "@gembala/shared"
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
import { Checkbox } from "@/components/ui/checkbox"
import { useUpdateRoom } from "@/lib/queries"

export function EditRoomDialog({
  room,
  trigger,
}: {
  room: RoomResponse
  trigger: React.ReactNode
}) {
  const updateRoom = useUpdateRoom()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(room.name)
  const [capacity, setCapacity] = useState(room.capacity ? String(room.capacity) : "")
  const [description, setDescription] = useState(room.description)
  const [isActive, setIsActive] = useState(room.isActive)

  const onOpenChange = (v: boolean) => {
    if (v) {
      setName(room.name)
      setCapacity(room.capacity ? String(room.capacity) : "")
      setDescription(room.description)
      setIsActive(room.isActive)
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      await updateRoom.mutateAsync({
        id: room.id,
        name,
        capacity: capacity ? Number(capacity) : null,
        description,
        isActive,
      })
      toast.success(`${name} updated`)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update room")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit room</DialogTitle>
          <DialogDescription>Update details for this room.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-room-name">Name</Label>
            <Input id="edit-room-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-room-capacity">Capacity</Label>
            <Input
              id="edit-room-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-room-description">Description</Label>
            <Textarea
              id="edit-room-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <Checkbox checked={isActive} onCheckedChange={(c) => setIsActive(c === true)} />
            <span className="text-sm">Active (bookable)</span>
          </label>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || updateRoom.isPending}>
            {updateRoom.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
