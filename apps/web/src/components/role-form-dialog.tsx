import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { permissionActionSchema, permissionResourceSchema, type RoleResponse } from "@gembala/shared"
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
import { Checkbox } from "@/components/ui/checkbox"
import { useCreateRole, useUpdateRole } from "@/lib/queries"

const RESOURCES = permissionResourceSchema.options
const ACTIONS = permissionActionSchema.options

export function RoleFormDialog({
  role,
  trigger,
}: {
  role?: RoleResponse
  trigger?: React.ReactNode
}) {
  const { t } = useTranslation("roles")
  const createRole = useCreateRole()
  const updateRole = useUpdateRole()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? []))

  const onOpenChange = (v: boolean) => {
    if (v) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setPerms(new Set(role?.permissions ?? []))
    }
    setOpen(v)
  }

  const toggle = (key: string) =>
    setPerms((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const save = async () => {
    try {
      const input = { name, description, permissions: [...perms] }
      if (role) {
        await updateRole.mutateAsync({ id: role.id, ...input })
        toast.success(t("dialog.successUpdated", { name }))
      } else {
        await createRole.mutateAsync(input)
        toast.success(t("dialog.successCreated", { name }))
      }
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dialog.error"))
    }
  }

  const saving = createRole.isPending || updateRole.isPending

  const resourceLabels: Record<string, string> = {
    members: t("common:nav.members"),
    groups: t("common:nav.groups"),
    households: t("permissions.resources.households"),
    tags: t("common:nav.tags"),
    invites: t("common:nav.invites"),
    rooms: t("common:nav.rooms"),
    events: t("common:nav.events"),
  }

  const actionLabels: Record<string, string> = {
    create: t("permissions.actions.create"),
    read: t("permissions.actions.read"),
    update: t("permissions.actions.update"),
    delete: t("permissions.actions.delete"),
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" /> {t("dialog.trigger")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{role ? t("dialog.editTitle") : t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="role-name">{t("dialog.nameLabel")}</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="role-description">{t("dialog.descriptionLabel")}</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("dialog.permissionsLabel")}</Label>
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="p-2 text-left font-medium">{t("dialog.resourceHeader")}</th>
                    {ACTIONS.map((a) => (
                      <th key={a} className="p-2 text-center font-medium capitalize">
                        {actionLabels[a]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RESOURCES.map((resource) => (
                    <tr key={resource} className="border-t">
                      <td className="p-2 capitalize">{resourceLabels[resource]}</td>
                      {ACTIONS.map((action) => {
                        const key = `${resource}:${action}`
                        return (
                          <td key={key} className="p-2 text-center">
                            <Checkbox
                              checked={perms.has(key)}
                              onCheckedChange={() => toggle(key)}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || saving}>
            {saving ? t("common:actions.saving") : role ? t("dialog.saveChanges") : t("dialog.createRole")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
