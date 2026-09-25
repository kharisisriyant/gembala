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
import { useCreateMember, useTags } from "@/lib/queries"
import { rootTags, childrenOf } from "@/lib/tag-tree"

const NONE = "__none__"

export function AddMemberDialog({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation("members")
  const { data: defs = [] } = useTags()
  const createMember = useCreateMember()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [picked, setPicked] = useState<string[]>(["members"])
  const [status, setStatus] = useState<"active" | "newcomer" | "inactive" | "moved">("active")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [gender, setGender] = useState<"" | "male" | "female">("")
  const [maritalStatus, setMaritalStatus] = useState<
    "" | "single" | "married" | "widowed" | "divorced"
  >("")
  const [address, setAddress] = useState("")
  const [occupation, setOccupation] = useState("")
  const [notes, setNotes] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [baptismStatus, setBaptismStatus] = useState<"" | "not_baptized" | "baptized">("")
  const [baptismDate, setBaptismDate] = useState("")

  const toggle = (t: string) =>
    setPicked((p) => (p.includes(t) ? p.filter((x) => x !== t) : [...p, t]))

  const reset = () => {
    setName("")
    setEmail("")
    setPhone("")
    setPicked(["members"])
    setStatus("active")
    setDateOfBirth("")
    setGender("")
    setMaritalStatus("")
    setAddress("")
    setOccupation("")
    setNotes("")
    setPhotoUrl("")
    setBaptismStatus("")
    setBaptismDate("")
  }

  const save = async () => {
    try {
      await createMember.mutateAsync({
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
      toast.success(t("add.toastAdded", { name }), {
        description: t("add.toastAddedDescription", {
          tags: picked.map((tag) => "#" + tag).join(" "),
        }),
      })
      reset()
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("add.toastError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("add.title")}</DialogTitle>
          <DialogDescription>{t("add.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto py-2 pr-1">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("form.fullName")}</Label>
            <Input id="name" placeholder={t("form.fullNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="email">{t("form.email")}</Label>
              <Input id="email" type="email" placeholder={t("form.emailPlaceholder")} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">{t("form.phone")}</Label>
              <Input id="phone" placeholder={t("form.phonePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>{t("form.tags")}</Label>
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
              <Label htmlFor="dob">{t("form.dateOfBirth")}</Label>
              <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label>{t("form.gender")}</Label>
              <Select value={gender || NONE} onValueChange={(v) => setGender(v === NONE ? "" : (v as "male" | "female"))}>
                <SelectTrigger className="w-full"><SelectValue placeholder={t("common:actions.notSpecified")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common:actions.notSpecified")}</SelectItem>
                  <SelectItem value="male">{t("options.gender.male")}</SelectItem>
                  <SelectItem value="female">{t("options.gender.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("form.maritalStatus")}</Label>
              <Select
                value={maritalStatus || NONE}
                onValueChange={(v) =>
                  setMaritalStatus(v === NONE ? "" : (v as "single" | "married" | "widowed" | "divorced"))
                }
              >
                <SelectTrigger className="w-full"><SelectValue placeholder={t("common:actions.notSpecified")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common:actions.notSpecified")}</SelectItem>
                  <SelectItem value="single">{t("options.maritalStatus.single")}</SelectItem>
                  <SelectItem value="married">{t("options.maritalStatus.married")}</SelectItem>
                  <SelectItem value="widowed">{t("options.maritalStatus.widowed")}</SelectItem>
                  <SelectItem value="divorced">{t("options.maritalStatus.divorced")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>{t("form.membershipStatus")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("status.active")}</SelectItem>
                  <SelectItem value="newcomer">{t("status.newcomer")}</SelectItem>
                  <SelectItem value="inactive">{t("status.inactive")}</SelectItem>
                  <SelectItem value="moved">{t("status.moved")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="occupation">{t("form.occupation")}</Label>
            <Input id="occupation" placeholder={t("form.occupationPlaceholder")} value={occupation} onChange={(e) => setOccupation(e.target.value)} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="address">{t("form.address")}</Label>
            <Textarea id="address" placeholder={t("form.addressPlaceholder")} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="photoUrl">{t("form.photoUrl")}</Label>
            <Input id="photoUrl" placeholder={t("form.photoUrlPlaceholder")} value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>{t("form.baptismStatus")}</Label>
              <Select
                value={baptismStatus || NONE}
                onValueChange={(v) => setBaptismStatus(v === NONE ? "" : (v as "not_baptized" | "baptized"))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder={t("common:actions.notSpecified")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common:actions.notSpecified")}</SelectItem>
                  <SelectItem value="not_baptized">{t("options.baptismStatus.notBaptized")}</SelectItem>
                  <SelectItem value="baptized">{t("options.baptismStatus.baptized")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baptismDate">{t("form.baptismDate")}</Label>
              <Input id="baptismDate" type="date" value={baptismDate} onChange={(e) => setBaptismDate(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">{t("form.notes")}</Label>
            <Textarea id="notes" placeholder={t("form.notesPlaceholder")} value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!name || picked.length === 0 || createMember.isPending}>
            {createMember.isPending ? t("common:actions.saving") : t("add.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
