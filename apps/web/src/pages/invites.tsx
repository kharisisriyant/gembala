import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { MailPlus } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { Tag, TagList } from "@/components/tag"
import { useAuth } from "@/lib/auth"
import { useAssignableRoles, useCreateInvite, useInvites, useRevokeInvite, useTags } from "@/lib/queries"
import { rootTags, childrenOf } from "@/lib/tag-tree"
import { formatDate } from "@/lib/helpers"

const statusVariant: Record<string, "success" | "warning" | "muted"> = {
  pending: "warning",
  accepted: "success",
  revoked: "muted",
  expired: "muted",
}

function InviteDialog() {
  const { t } = useTranslation("invites")
  const { data: tags = [] } = useTags()
  const { data: assignableRoles = [] } = useAssignableRoles()
  const createInvite = useCreateInvite()
  const [email, setEmail] = useState("")
  const [pickedRoles, setPickedRoles] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))
  const toggleRole = (id: string) =>
    setPickedRoles((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const save = async () => {
    try {
      await createInvite.mutateAsync({ email, roleIds: pickedRoles, scopeTags: picked })
      toast.success(t("toast.sent", { email }), {
        description: t("toast.sentDescription"),
      })
      setEmail("")
      setPickedRoles([])
      setPicked([])
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.sendError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MailPlus className="size-4" /> {t("dialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="invite-email">{t("dialog.emailLabel")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("dialog.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>{t("dialog.rolesLabel")}</Label>
            <div className="space-y-1.5 rounded-md border p-3">
              {assignableRoles.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={pickedRoles.includes(r.id)}
                    onCheckedChange={() => toggleRole(r.id)}
                  />
                  <span className="text-sm">{r.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("dialog.scopeTagsLabel")}</Label>
            <div className="space-y-2.5 rounded-md border p-3">
              {rootTags(tags).map((root) => {
                const kids = childrenOf(tags, root.name)
                return (
                  <div key={root.name} className="flex flex-wrap items-center gap-1.5">
                    <Tag name={root.name} onClick={() => toggle(root.name)} active={picked.includes(root.name)} />
                    {kids.map((c) => (
                      <Tag key={c.name} name={c.name} onClick={() => toggle(c.name)} active={picked.includes(c.name)} />
                    ))}
                  </div>
                )
              })}
            </div>
            <p className="text-muted-foreground text-xs">{t("dialog.scopeTagsHint")}</p>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button
            onClick={save}
            disabled={!email || pickedRoles.length === 0 || picked.length === 0 || createInvite.isPending}
          >
            {createInvite.isPending ? t("dialog.sending") : t("dialog.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function InvitesPage() {
  const { t } = useTranslation("invites")
  const { hasPermission } = useAuth()
  const { data: invites = [], isLoading } = useInvites()
  const revoke = useRevokeInvite()

  return (
    <div>
      <PageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        action={hasPermission("invites", "create") ? <InviteDialog /> : undefined}
      />

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>{t("table.email")}</TableHead>
              <TableHead>{t("table.role")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("table.scope")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("table.expires")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {inv.roles.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <TagList tags={inv.scopeTags} />
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[inv.status]}>{t(`status.${inv.status}`)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                  {formatDate(inv.expiresAt.slice(0, 10))}
                </TableCell>
                <TableCell className="text-right">
                  {inv.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await revoke.mutateAsync(inv.id)
                        toast(t("toast.revoked", { email: inv.email }))
                      }}
                    >
                      {t("actions.revoke")}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && invites.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-10 text-center">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
