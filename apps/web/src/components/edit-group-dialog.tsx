import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation("groups")
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
      toast.success(t("editGroupDialog.successToast", { name }))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("editGroupDialog.errorToast"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("editGroupDialog.title")}</DialogTitle>
          <DialogDescription>{t("editGroupDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid gap-2">
            <Label htmlFor="edit-group-name">{t("editGroupDialog.name")}</Label>
            <Input
              id="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("editGroupDialog.leader")}</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("editGroupDialog.leaderPlaceholder")} />
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
              <Label>{t("editGroupDialog.scopeTag")}</Label>
              <Select value={scopeTag} onValueChange={setScopeTag}>
                <SelectTrigger>
                  <SelectValue placeholder={t("editGroupDialog.scopeTagPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tg) => (
                    <SelectItem key={tg.name} value={tg.name}>
                      #{tg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-group-schedule">{t("editGroupDialog.schedule")}</Label>
              <Input
                id="edit-group-schedule"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-group-location">{t("editGroupDialog.location")}</Label>
              <Input
                id="edit-group-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("editGroupDialog.members")}</Label>
              <span className="text-muted-foreground text-xs">
                {t("editGroupDialog.selected", { count: memberIds.length })}
              </span>
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
            <p className="text-muted-foreground text-xs">{t("editGroupDialog.leaderIncluded")}</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || !leaderId || !scopeTag || updateGroup.isPending}>
            {updateGroup.isPending ? t("common:actions.saving") : t("editGroupDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
