import { useEffect, useState } from "react"
import { toast } from "sonner"
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
import { Checkbox } from "@/components/ui/checkbox"
import { MemberAvatar } from "@/components/member-avatar"
import { useMembers, useTags, useUpdateGroup } from "@/lib/queries"

export type EditableGroup = {
  id: string
  name: string
  leaderId: string
  scopeTag: string
  memberIds: string[]
  schedule: string
  location: string
}

export function EditGroupDialog({
  trigger,
  group,
}: {
  trigger: React.ReactNode
  group: EditableGroup
}) {
  const { data: members = [] } = useMembers()
  const { data: tags = [] } = useTags()
  const updateGroup = useUpdateGroup()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(group.name)
  const [leaderId, setLeaderId] = useState(group.leaderId)
  const [scopeTag, setScopeTag] = useState(group.scopeTag)
  const [memberIds, setMemberIds] = useState<string[]>(group.memberIds)
  const [schedule, setSchedule] = useState(group.schedule)
  const [location, setLocation] = useState(group.location)

  useEffect(() => {
    if (!open) return
    setName(group.name)
    setLeaderId(group.leaderId)
    setScopeTag(group.scopeTag)
    setMemberIds(group.memberIds)
    setSchedule(group.schedule)
    setLocation(group.location)
  }, [open, group])

  const toggle = (id: string) =>
    setMemberIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const save = async () => {
    try {
      await updateGroup.mutateAsync({
        id: group.id,
        name,
        leaderId,
        scopeTag,
        memberIds,
        schedule,
        location,
      })
      toast.success(`${name} updated`)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update group")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit small group</DialogTitle>
          <DialogDescription>
            The scope tag decides which leaders can see this group.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-group-name">Name</Label>
            <Input
              id="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Leader</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a leader" />
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
            <div className="grid gap-2">
              <Label>Scope tag</Label>
              <Select value={scopeTag} onValueChange={setScopeTag}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.name} value={t.name}>
                      #{t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-group-schedule">Schedule</Label>
              <Input
                id="edit-group-schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-group-location">Location</Label>
              <Input
                id="edit-group-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Members</Label>
              <span className="text-muted-foreground text-xs">{memberIds.length} selected</span>
            </div>
            <div className="grid gap-1.5 rounded-md border p-2 sm:grid-cols-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="hover:bg-accent/40 flex cursor-pointer items-center gap-2 rounded-md p-1.5"
                >
                  <Checkbox checked={memberIds.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                  <MemberAvatar name={m.name} className="size-6" />
                  <span className="text-sm">{m.name}</span>
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">The leader is always included.</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || !leaderId || !scopeTag || updateGroup.isPending}>
            {updateGroup.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
