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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tag } from "@/components/tag"
import { useCreateMember, useTags } from "@/lib/queries"
import { rootTags, childrenOf } from "@/lib/tag-tree"

export function AddMemberDialog({ trigger }: { trigger: React.ReactNode }) {
  const { data: defs = [] } = useTags()
  const createMember = useCreateMember()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [picked, setPicked] = useState<string[]>(["members"])

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  const save = async () => {
    try {
      await createMember.mutateAsync({
        name,
        email,
        phone,
        tags: picked,
        status: "active",
      })
      toast.success(`${name} added`, {
        description: `Tagged ${picked.map((t) => "#" + t).join(" ")}`,
      })
      setName("")
      setEmail("")
      setPhone("")
      setPicked(["members"])
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add member")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>
            Tags decide which leaders can see this person and which groups fit.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" placeholder="e.g. Sarah Wijaya" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="sarah@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="0812-…" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="space-y-2.5 rounded-md border p-3">
              {rootTags(defs).map((root) => {
                const kids = childrenOf(defs, root.name)
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
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || picked.length === 0 || createMember.isPending}>
            {createMember.isPending ? "Saving…" : "Save member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
