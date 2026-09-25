import { useState } from "react"
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
import { useCreateTag, useTags } from "@/lib/queries"

const NONE = "__none__"

export function AddTagDialog({
  trigger,
  defaultParent,
}: {
  trigger: React.ReactNode
  defaultParent?: string | null
}) {
  const { t } = useTranslation("tags")
  const { data: defs = [] } = useTags()
  const createTag = useCreateTag()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [parent, setParent] = useState<string>(defaultParent ?? NONE)
  const [description, setDescription] = useState("")

  const slug = name.trim().toLowerCase().replace(/\s+/g, "-").replace(/^#/, "")
  const taken = defs.some((d) => d.name === slug)

  const save = async () => {
    try {
      await createTag.mutateAsync({
        name: slug,
        parent: parent === NONE ? null : parent,
        description: description || undefined,
      })
      toast.success(t("dialog.toast.created", { name: slug }), {
        description: parent === NONE ? t("dialog.toast.topLevel") : t("dialog.toast.childOf", { name: parent }),
      })
      setName("")
      setDescription("")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("dialog.toast.createError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("dialog.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tag-name">{t("dialog.nameLabel")}</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm">#</span>
              <Input
                id="tag-name"
                className="pl-7 font-mono"
                placeholder={t("dialog.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {taken && <p className="text-destructive text-xs">{t("dialog.nameTaken", { name: slug })}</p>}
          </div>
          <div className="grid gap-2">
            <Label>{t("dialog.parentLabel")}</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("dialog.parentNone")}</SelectItem>
                {defs.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    #{d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tag-desc">{t("dialog.descriptionLabel")}</Label>
            <Input
              id="tag-desc"
              placeholder={t("dialog.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!slug || taken || createTag.isPending}>
            {createTag.isPending ? t("dialog.creating") : t("dialog.create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
