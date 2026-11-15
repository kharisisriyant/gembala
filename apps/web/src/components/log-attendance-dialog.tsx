import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { ClipboardCheck } from "lucide-react"
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
import { MemberAvatar } from "@/components/member-avatar"
import { SESSION_EXCUSE_REASON_MAX, type GroupDetailResponse, type SessionResponse } from "@gembala/shared"
import { useLogAttendance, useUpdateSession } from "@/lib/queries"
import { cn } from "@/lib/utils"

// Absent is the default: a member with no mark was absent.
type Mark = "present" | "excused"

const MARKS = ["present", "excused", "absent"] as const

/**
 * Log a new meeting, or edit an existing one when `session` is given. Each
 * roster member is present, excused (with an optional reason) or absent.
 */
export function LogAttendanceDialog({
  group,
  session,
  trigger,
}: {
  group: GroupDetailResponse
  session?: SessionResponse
  trigger?: ReactNode
}) {
  const { t } = useTranslation("groups")
  const logAttendance = useLogAttendance(group.id)
  const updateSession = useUpdateSession(group.id)
  const isEdit = session !== undefined
  const pending = isEdit ? updateSession.isPending : logAttendance.isPending
  const today = new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today)
  const [marks, setMarks] = useState<Record<string, Mark>>({})
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [topic, setTopic] = useState("")
  const [prayerNotes, setPrayerNotes] = useState("")

  // Fill the form when the dialog opens: from the session being edited, or blank.
  const reset = () => {
    const nextMarks: Record<string, Mark> = {}
    const nextReasons: Record<string, string> = {}
    for (const id of session?.presentIds ?? []) nextMarks[id] = "present"
    for (const e of session?.excused ?? []) {
      nextMarks[e.memberId] = "excused"
      nextReasons[e.memberId] = e.reason
    }
    setMarks(nextMarks)
    setReasons(nextReasons)
    setDate(session?.date ?? today)
    setTopic(session?.topic ?? "")
    setPrayerNotes(session?.prayerNotes ?? "")
  }

  const onOpenChange = (next: boolean) => {
    if (next) reset()
    setOpen(next)
  }

  const setMark = (id: string, mark: (typeof MARKS)[number]) =>
    setMarks((m) => {
      const next = { ...m }
      if (mark === "absent") delete next[id]
      else next[id] = mark
      return next
    })

  const rosterIds = new Set(group.members.map((m) => m.id))
  const presentIds = group.members.filter((m) => marks[m.id] === "present").map((m) => m.id)
  const excused = group.members
    .filter((m) => marks[m.id] === "excused")
    .map((m) => ({ memberId: m.id, reason: (reasons[m.id] ?? "").trim() }))
  // Members who left the roster since the session was logged keep their marks.
  for (const [id, mark] of Object.entries(marks)) {
    if (rosterIds.has(id)) continue
    if (mark === "present") presentIds.push(id)
    else excused.push({ memberId: id, reason: (reasons[id] ?? "").trim() })
  }

  const save = async () => {
    try {
      if (session) {
        await updateSession.mutateAsync({ sessionId: session.id, date, topic, presentIds, excused, prayerNotes })
        toast.success(t("logAttendanceDialog.updatedToast"))
      } else {
        await logAttendance.mutateAsync({ date, topic, presentIds, excused, prayerNotes })
        toast.success(t("logAttendanceDialog.successToast"), {
          description: t("logAttendanceDialog.successDescription", {
            count: presentIds.length,
            topic: topic || t("logAttendanceDialog.noTopic"),
          }),
        })
      }
      setOpen(false)
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : t(isEdit ? "logAttendanceDialog.updateErrorToast" : "logAttendanceDialog.errorToast"),
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <ClipboardCheck className="size-4" /> {t("logAttendanceDialog.trigger")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {t(isEdit ? "logAttendanceDialog.editTitle" : "logAttendanceDialog.title", { name: group.name })}
          </DialogTitle>
          <DialogDescription>{t("logAttendanceDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="date">{t("logAttendanceDialog.date")}</Label>
              <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="topic">{t("logAttendanceDialog.topic")}</Label>
              <Input
                id="topic"
                placeholder={t("logAttendanceDialog.topicPlaceholder")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("logAttendanceDialog.whoCame")}</Label>
              <span className="text-muted-foreground text-xs">
                {t("logAttendanceDialog.tally", { present: presentIds.length, excused: excused.length })}
              </span>
            </div>
            <div className="divide-y rounded-md border">
              {group.members.map((m) => {
                const current = marks[m.id] ?? "absent"
                return (
                  <div key={m.id} className="space-y-2 p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <MemberAvatar name={m.name} className="size-6" />
                      <span className="min-w-0 flex-1 truncate text-sm">{m.name}</span>
                      <div
                        role="radiogroup"
                        aria-label={m.name}
                        className="bg-muted/40 inline-flex rounded-md border p-0.5"
                      >
                        {MARKS.map((mark) => (
                          <button
                            key={mark}
                            type="button"
                            role="radio"
                            aria-checked={current === mark}
                            onClick={() => setMark(m.id, mark)}
                            className={cn(
                              "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                              current === mark
                                ? mark === "present"
                                  ? "bg-primary text-primary-foreground"
                                  : mark === "excused"
                                    ? "bg-warning-soft text-warning-foreground"
                                    : "bg-background text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {t(`logAttendanceDialog.status.${mark}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {current === "excused" && (
                      <Input
                        aria-label={t("logAttendanceDialog.reasonLabel", { name: m.name })}
                        placeholder={t("logAttendanceDialog.reasonPlaceholder")}
                        maxLength={SESSION_EXCUSE_REASON_MAX}
                        value={reasons[m.id] ?? ""}
                        onChange={(e) => setReasons((r) => ({ ...r, [m.id]: e.target.value }))}
                        className="h-8 text-sm"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prayer">{t("logAttendanceDialog.prayerNotes")}</Label>
            <Textarea
              id="prayer"
              rows={3}
              placeholder={t("logAttendanceDialog.prayerNotesPlaceholder")}
              value={prayerNotes}
              onChange={(e) => setPrayerNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={pending}>
            {pending
              ? t("common:actions.saving")
              : isEdit
                ? t("common:actions.save")
                : t("logAttendanceDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
