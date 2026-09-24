import { useEffect, useState } from "react"
import { toast } from "sonner"
import type { MemberResponse } from "@gembala/shared"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tag } from "@/components/tag"
import { useTags, useUpdateMember } from "@/lib/queries"
import { rootTags, childrenOf } from "@/lib/tag-tree"

const NONE = "__none__"

export function EditMemberDialog({
  trigger,
  member,
}: {
  trigger: React.ReactNode
  member: MemberResponse
}) {
  const { data: defs = [] } = useTags()
  const updateMember = useUpdateMember()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(member.name)
  const [email, setEmail] = useState(member.email)
  const [phone, setPhone] = useState(member.phone)
  const [picked, setPicked] = useState<string[]>(member.tags)
  const [status, setStatus] = useState(member.status)
  const [dateOfBirth, setDateOfBirth] = useState(member.dateOfBirth ?? "")
  const [gender, setGender] = useState<"" | "male" | "female">(member.gender ?? "")
  const [maritalStatus, setMaritalStatus] = useState<
    "" | "single" | "married" | "widowed" | "divorced"
  >(member.maritalStatus ?? "")
  const [address, setAddress] = useState(member.address)
  const [occupation, setOccupation] = useState(member.occupation)
  const [notes, setNotes] = useState(member.notes)
  const [photoUrl, setPhotoUrl] = useState(member.photoUrl)
  const [baptismStatus, setBaptismStatus] = useState<"" | "not_baptized" | "baptized">(
    member.baptismStatus ?? "",
  )
  const [baptismDate, setBaptismDate] = useState(member.baptismDate ?? "")

  useEffect(() => {
    if (!open) return
    setName(member.name)
    setEmail(member.email)
    setPhone(member.phone)
    setPicked(member.tags)
    setStatus(member.status)
    setDateOfBirth(member.dateOfBirth ?? "")
    setGender(member.gender ?? "")
    setMaritalStatus(member.maritalStatus ?? "")
    setAddress(member.address)
    setOccupation(member.occupation)
    setNotes(member.notes)
    setPhotoUrl(member.photoUrl)
    setBaptismStatus(member.baptismStatus ?? "")
    setBaptismDate(member.baptismDate ?? "")
  }, [open, member])

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  const save = async () => {
    try {
      await updateMember.mutateAsync({
        id: member.id,
        name,
        email,
        phone,
        tags: picked,
        status,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        maritalStatus: maritalStatus || undefined,
        address,
        occupation,
        notes,
        photoUrl,
        baptismStatus: baptismStatus || undefined,
        baptismDate: baptismDate || undefined,
      })
      toast.success(`${name} updated`)
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update member")
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit member</DialogTitle>
          <DialogDescription>
            Tags decide which leaders can see this person and which groups fit.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Full name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input id="edit-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-dob">Date of birth</Label>
              <Input id="edit-dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>Gender</Label>
              <Select value={gender || NONE} onValueChange={(v) => setGender(v === NONE ? "" : (v as "male" | "female"))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Marital status</Label>
              <Select
                value={maritalStatus || NONE}
                onValueChange={(v) =>
                  setMaritalStatus(v === NONE ? "" : (v as "single" | "married" | "widowed" | "divorced"))
                }
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="married">Married</SelectItem>
                  <SelectItem value="widowed">Widowed</SelectItem>
                  <SelectItem value="divorced">Divorced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Membership status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="newcomer">Newcomer</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="moved">Moved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-occupation">Occupation</Label>
            <Input id="edit-occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-address">Address</Label>
            <Textarea id="edit-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-photoUrl">Photo URL</Label>
            <Input id="edit-photoUrl" placeholder="https://…" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Baptism status</Label>
              <Select
                value={baptismStatus || NONE}
                onValueChange={(v) => setBaptismStatus(v === NONE ? "" : (v as "not_baptized" | "baptized"))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Not specified" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not specified</SelectItem>
                  <SelectItem value="not_baptized">Not baptized</SelectItem>
                  <SelectItem value="baptized">Baptized</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-baptismDate">Baptism date</Label>
              <Input id="edit-baptismDate" type="date" value={baptismDate} onChange={(e) => setBaptismDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || picked.length === 0 || updateMember.isPending}>
            {updateMember.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
