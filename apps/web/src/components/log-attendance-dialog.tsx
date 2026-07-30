import { useState } from "react"
import { toast } from "sonner"
import { ClipboardCheck } from "lucide-react"
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
import { MemberAvatar } from "@/components/member-avatar"
import type { GroupDetailResponse } from "@gembala/shared"
import { useLogAttendance } from "@/lib/queries"

export function LogAttendanceDialog({ group }: { group: GroupDetailResponse }) {
  const logAttendance = useLogAttendance(group.id)
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [present, setPresent] = useState<string[]>([])
  const [topic, setTopic] = useState("")
  const [prayerNotes, setPrayerNotes] = useState("")

  const toggle = (id: string) =>
    setPresent((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const save = async () => {
    try {
      await logAttendance.mutateAsync({ date, topic, presentIds: present, prayerNotes })
      toast.success("Attendance logged", {
        description: `${present.length} present · ${topic || "no topic"}`,
      })
      setPresent([])
      setTopic("")
      setPrayerNotes("")
      setDate(today)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not log attendance")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <ClipboardCheck className="size-4" /> Log attendance
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log meeting — {group.name}</DialogTitle>
          <DialogDescription>Record who came, the topic, and prayer notes.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topic">Topic</Label>
              <Input id="topic" placeholder="e.g. Romans 8" value={topic} onChange={(e) => setTopic(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Who came?</Label>
              <span className="text-muted-foreground text-xs">{present.length} selected</span>
            </div>
            <div className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-2">
              {group.members.map((m) => (
                <label
                  key={m.id}
                  className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md p-1.5"
                >
                  <Checkbox checked={present.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                  <MemberAvatar name={m.name} className="size-6" />
                  <span className="text-sm">{m.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prayer">Prayer notes</Label>
            <Textarea
              id="prayer"
              rows={3}
              placeholder="Requests, praise reports, follow-ups…"
              value={prayerNotes}
              onChange={(e) => setPrayerNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={logAttendance.isPending}>
            {logAttendance.isPending ? "Saving…" : "Save meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
