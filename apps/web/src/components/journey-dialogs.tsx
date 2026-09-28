import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import {
  leadershipLevelSchema,
  leadershipTargetRoleSchema,
  milestoneTypeSchema,
  type LeadershipLevel,
  type LeadershipTargetRole,
  type MilestoneType,
} from "@gembala/shared"
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
import {
  useAddLeadershipAssessment,
  useAddMilestone,
  useCourses,
  useEnrollMember,
} from "@/lib/queries"

const today = () => new Date().toISOString().slice(0, 10)

type DialogProps = { memberId: string; memberName: string; trigger: React.ReactNode }

export function MilestoneDialog({ memberId, memberName, trigger }: DialogProps) {
  const { t } = useTranslation("journey")
  const add = useAddMilestone()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<MilestoneType>("first_visit")
  const [achievedAt, setAchievedAt] = useState(today())
  const [note, setNote] = useState("")

  const onOpenChange = (v: boolean) => {
    if (v) {
      setType("first_visit")
      setAchievedAt(today())
      setNote("")
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      await add.mutateAsync({ memberId, type, achievedAt, note: note.trim() || undefined })
      toast.success(t("milestoneForm.added"))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("milestoneForm.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("milestoneForm.title")}</DialogTitle>
          <DialogDescription>{t("milestoneForm.description", { name: memberName })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>{t("milestoneForm.type")}</Label>
            <Select value={type} onValueChange={(v) => setType(v as MilestoneType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {milestoneTypeSchema.options.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`milestone.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="milestone-date">{t("milestoneForm.date")}</Label>
            <Input
              id="milestone-date"
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="milestone-note">{t("milestoneForm.note")}</Label>
            <Textarea
              id="milestone-note"
              rows={3}
              maxLength={2000}
              placeholder={t("milestoneForm.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!achievedAt || add.isPending}>
            {add.isPending ? t("common:actions.saving") : t("milestoneForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function EnrollDialog({ memberId, memberName, trigger }: DialogProps) {
  const { t } = useTranslation("journey")
  const enroll = useEnrollMember()
  const { data: courses = [] } = useCourses()
  const [open, setOpen] = useState(false)
  const [courseId, setCourseId] = useState("")
  const [startedAt, setStartedAt] = useState(today())

  const onOpenChange = (v: boolean) => {
    if (v) {
      setCourseId("")
      setStartedAt(today())
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      await enroll.mutateAsync({ memberId, courseId, startedAt })
      toast.success(t("enrollForm.enrolled"))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("enrollForm.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("enrollForm.title")}</DialogTitle>
          <DialogDescription>{t("enrollForm.description", { name: memberName })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {courses.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("enrollForm.noCourses")}</p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label>{t("enrollForm.course")}</Label>
                <Select value={courseId} onValueChange={setCourseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t("enrollForm.coursePlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} · {t(`courseKind.${c.kind}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="enroll-start">{t("enrollForm.startedAt")}</Label>
                <Input
                  id="enroll-start"
                  type="date"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!courseId || !startedAt || enroll.isPending}>
            {enroll.isPending ? t("common:actions.saving") : t("enrollForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssessmentDialog({ memberId, memberName, trigger }: DialogProps) {
  const { t } = useTranslation("journey")
  const assess = useAddLeadershipAssessment()
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<LeadershipLevel>("emerging")
  const [targetRole, setTargetRole] = useState<LeadershipTargetRole>("cell_leader")
  const [note, setNote] = useState("")

  const onOpenChange = (v: boolean) => {
    if (v) {
      setLevel("emerging")
      setTargetRole("cell_leader")
      setNote("")
    }
    setOpen(v)
  }

  const save = async () => {
    try {
      await assess.mutateAsync({ memberId, level, targetRole, note: note.trim() || undefined })
      toast.success(t("assessForm.saved"))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("assessForm.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("assessForm.title")}</DialogTitle>
          <DialogDescription>{t("assessForm.description", { name: memberName })}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label>{t("assessForm.level")}</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as LeadershipLevel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadershipLevelSchema.options.map((l) => (
                  <SelectItem key={l} value={l}>
                    {t(`level.${l}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>{t("assessForm.targetRole")}</Label>
            <Select value={targetRole} onValueChange={(v) => setTargetRole(v as LeadershipTargetRole)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leadershipTargetRoleSchema.options.map((r) => (
                  <SelectItem key={r} value={r}>
                    {t(`targetRole.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="assess-note">{t("assessForm.note")}</Label>
            <Textarea
              id="assess-note"
              rows={3}
              maxLength={2000}
              placeholder={t("assessForm.notePlaceholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={assess.isPending}>
            {assess.isPending ? t("common:actions.saving") : t("assessForm.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
