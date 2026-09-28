import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus, Trash2 } from "lucide-react"
import { enrollmentStatusSchema, type EnrollmentStatus } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AssessmentDialog, EnrollDialog, MilestoneDialog } from "@/components/journey-dialogs"
import { useAuth } from "@/lib/auth"
import { useDeleteMilestone, useMemberJourney, useUpdateEnrollment } from "@/lib/queries"
import { formatDate } from "@/lib/helpers"

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="text-muted-foreground text-xs font-medium uppercase">{title}</div>
      {action}
    </div>
  )
}

const addButton = (label: string) => (
  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
    <Plus className="size-3.5" /> {label}
  </Button>
)

// "Spiritual journey" section of the member detail sheet.
export function MemberJourney({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { t } = useTranslation("journey")
  const { hasPermission } = useAuth()
  const canRead = hasPermission("journey", "read")
  const canCreate = hasPermission("journey", "create")
  const canUpdate = hasPermission("journey", "update")
  const canDelete = hasPermission("journey", "delete")
  const { data: journey } = useMemberJourney(memberId, canRead)
  const removeMilestone = useDeleteMilestone()
  const updateEnrollment = useUpdateEnrollment()

  if (!canRead) return null

  const setStatus = async (id: string, status: EnrollmentStatus) => {
    try {
      await updateEnrollment.mutateAsync({ id, status })
      toast.success(t("enrollForm.statusUpdated"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("enrollForm.statusError"))
    }
  }

  const deleteMilestone = async (id: string) => {
    try {
      await removeMilestone.mutateAsync(id)
      toast(t("milestoneForm.deleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("milestoneForm.deleteError"))
    }
  }

  const milestones = journey?.milestones ?? []
  const enrollments = journey?.enrollments ?? []
  const current = journey?.assessments[0]

  return (
    <div className="space-y-5">
      <div className="text-sm font-semibold">{t("memberSection.title")}</div>

      <div>
        <SectionHeader
          title={t("memberSection.milestones")}
          action={
            canCreate && (
              <MilestoneDialog
                memberId={memberId}
                memberName={memberName}
                trigger={addButton(t("memberSection.addMilestone"))}
              />
            )
          }
        />
        <div className="space-y-2">
          {milestones.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
              <div>
                <div className="font-medium">{t(`milestone.${m.type}`)}</div>
                {m.note && <div className="text-muted-foreground whitespace-pre-wrap text-xs">{m.note}</div>}
                <div className="text-muted-foreground mt-0.5 text-xs">
                  {formatDate(m.achievedAt)}
                  {m.recordedBy ? ` · ${t("memberSection.recordedBy", { name: m.recordedBy.name })}` : ""}
                </div>
              </div>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0"
                  aria-label={t("memberSection.deleteMilestone")}
                  onClick={() => deleteMilestone(m.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          ))}
          {milestones.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("memberSection.noMilestones")}</p>
          )}
        </div>
      </div>

      <div>
        <SectionHeader
          title={t("memberSection.courses")}
          action={
            canCreate && (
              <EnrollDialog
                memberId={memberId}
                memberName={memberName}
                trigger={addButton(t("memberSection.enroll"))}
              />
            )
          }
        />
        <div className="space-y-2">
          {enrollments.map((e) => (
            <div key={e.id} className="rounded-md border p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-medium">{e.course.name}</span>{" "}
                  <Badge variant="muted">{t(`courseKind.${e.course.kind}`)}</Badge>
                </div>
                {canUpdate ? (
                  <Select value={e.status} onValueChange={(v) => setStatus(e.id, v as EnrollmentStatus)}>
                    <SelectTrigger size="sm" className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {enrollmentStatusSchema.options.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(`enrollmentStatus.${s}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant={e.status === "completed" ? "success" : "info"}>
                    {t(`enrollmentStatus.${e.status}`)}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                {t("memberSection.started", { date: formatDate(e.startedAt) })}
                {e.completedAt ? ` · ${t("memberSection.completed", { date: formatDate(e.completedAt) })}` : ""}
              </div>
            </div>
          ))}
          {enrollments.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("memberSection.noCourses")}</p>
          )}
        </div>
      </div>

      <div>
        <SectionHeader
          title={t("memberSection.leadership")}
          action={
            canCreate && (
              <AssessmentDialog
                memberId={memberId}
                memberName={memberName}
                trigger={addButton(t("memberSection.assess"))}
              />
            )
          }
        />
        {current ? (
          <div className="rounded-md border p-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={current.level === "ready" ? "success" : "info"}>{t(`level.${current.level}`)}</Badge>
              <span>{t(`targetRole.${current.targetRole}`)}</span>
            </div>
            {current.note && <div className="mt-1 whitespace-pre-wrap text-xs">{current.note}</div>}
            <div className="text-muted-foreground mt-1 text-xs">
              {formatDate(current.assessedAt.slice(0, 10))}
              {current.assessedBy ? ` · ${t("memberSection.recordedBy", { name: current.assessedBy.name })}` : ""}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">{t("memberSection.noAssessment")}</p>
        )}
      </div>
    </div>
  )
}
