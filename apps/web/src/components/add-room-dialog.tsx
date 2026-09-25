import { useState } from "react"
import { toast } from "sonner"
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
      toast.success(`${name} added`)
      setName("")
      setCapacity("")
      setDescription("")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add room")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> New room
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New room</DialogTitle>
          <DialogDescription>A physical space events can be booked into.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="room-name">Name</Label>
            <Input
              id="room-name"
              placeholder="e.g. Main Hall"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="room-capacity">Capacity</Label>
            <Input
              id="room-capacity"
              type="number"
              min={1}
              placeholder="e.g. 200"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="room-description">Description</Label>
            <Textarea
              id="room-description"
              placeholder="e.g. 2nd floor, has projector"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || createRoom.isPending}>
            {createRoom.isPending ? "Adding…" : "Add room"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
