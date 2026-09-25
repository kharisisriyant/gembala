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
import { Checkbox } from "@/components/ui/checkbox"
import { MemberAvatar } from "@/components/member-avatar"
import { useCreateGroup, useMembers, useTags } from "@/lib/queries"

export function AddGroupDialog() {
  const { t } = useTranslation("groups")
  const { data: members = [] } = useMembers()
  const { data: tags = [] } = useTags()
  const createGroup = useCreateGroup()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [leaderId, setLeaderId] = useState("")
  const [scopeTag, setScopeTag] = useState("")
  const [memberIds, setMemberIds] = useState<string[]>([])
  const [schedule, setSchedule] = useState("")
  const [location, setLocation] = useState("")

  const toggle = (id: string) =>
    setMemberIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const save = async () => {
    try {
      await createGroup.mutateAsync({ name, leaderId, scopeTag, memberIds, schedule, location })
      toast.success(t("addGroupDialog.successToast", { name }))
      setName("")
      setLeaderId("")
      setScopeTag("")
      setMemberIds([])
      setSchedule("")
      setLocation("")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("addGroupDialog.errorToast"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> {t("addGroupDialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("addGroupDialog.title")}</DialogTitle>
          <DialogDescription>{t("addGroupDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid gap-2">
            <Label htmlFor="group-name">{t("addGroupDialog.name")}</Label>
            <Input
              id="group-name"
              placeholder={t("addGroupDialog.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("addGroupDialog.leader")}</Label>
              <Select value={leaderId} onValueChange={setLeaderId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("addGroupDialog.leaderPlaceholder")} />
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
              <Label>{t("addGroupDialog.scopeTag")}</Label>
              <Select value={scopeTag} onValueChange={setScopeTag}>
                <SelectTrigger>
                  <SelectValue placeholder={t("addGroupDialog.scopeTagPlaceholder")} />
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
              <Label htmlFor="group-schedule">{t("addGroupDialog.schedule")}</Label>
              <Input
                id="group-schedule"
                placeholder={t("addGroupDialog.schedulePlaceholder")}
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-location">{t("addGroupDialog.location")}</Label>
              <Input
                id="group-location"
                placeholder={t("addGroupDialog.locationPlaceholder")}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("addGroupDialog.members")}</Label>
              <span className="text-muted-foreground text-xs">
                {t("addGroupDialog.selected", { count: memberIds.length })}
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
            <p className="text-muted-foreground text-xs">{t("addGroupDialog.leaderIncluded")}</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || !leaderId || !scopeTag || createGroup.isPending}>
            {createGroup.isPending ? t("addGroupDialog.creating") : t("addGroupDialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
