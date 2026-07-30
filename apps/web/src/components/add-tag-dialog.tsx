import { useState } from "react"
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
import { useCreateTag, useTags } from "@/lib/queries"

const NONE = "__none__"

export function AddTagDialog({
  trigger,
  defaultParent,
}: {
  trigger: React.ReactNode
  defaultParent?: string | null
}) {
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
      toast.success(`#${slug} created`, {
        description: parent === NONE ? "Top-level tag" : `Child of #${parent}`,
      })
      setName("")
      setDescription("")
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create tag")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New tag</DialogTitle>
          <DialogDescription>
            Give it a parent to nest it. A parent's scope covers all its children.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="tag-name">Name</Label>
            <div className="relative">
              <span className="text-muted-foreground absolute top-1/2 left-3 -translate-y-1/2 font-mono text-sm">#</span>
              <Input
                id="tag-name"
                className="pl-7 font-mono"
                placeholder="drummer"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {taken && <p className="text-destructive text-xs">#{slug} already exists.</p>}
          </div>
          <div className="grid gap-2">
            <Label>Parent tag</Label>
            <Select value={parent} onValueChange={setParent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— none (top-level) —</SelectItem>
                {defs.map((d) => (
                  <SelectItem key={d.name} value={d.name}>
                    #{d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tag-desc">Description (optional)</Label>
            <Input
              id="tag-desc"
              placeholder="e.g. Drum & percussion team"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!slug || taken || createTag.isPending}>
            {createTag.isPending ? "Creating…" : "Create tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
