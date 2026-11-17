import { useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  ArrowLeft,
  MapPin,
  CalendarClock,
  Users,
  Check,
  X,
  Lock,
  Pencil,
  Trash2,
  CircleSlash,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { MemberAvatar } from "@/components/member-avatar"
import { Tag, TagList } from "@/components/tag"
import { LogAttendanceDialog } from "@/components/log-attendance-dialog"
import { EditGroupDialog } from "@/components/edit-group-dialog"
import { useAuth } from "@/lib/auth"
import { useDeleteSession, useGroup } from "@/lib/queries"
import { ApiError } from "@/lib/api"
import { formatDate } from "@/lib/helpers"
import type { SessionResponse } from "@gembala/shared"

export function GroupDetailPage() {
  const { t } = useTranslation("groups")
  const { id } = useParams()
  const { hasPermission } = useAuth()
  const canUpdate = hasPermission("groups", "update")
  const { data: group, isLoading, error } = useGroup(id)

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">{t("groupDetail.loading")}</p>
  }
  if (error instanceof ApiError && error.status === 403) {
    return <Restricted message={t("groupDetail.restrictedOutsideAccess")} />
  }
  if (error || !group) {
    return <Restricted message={t("groupDetail.restrictedNotFound")} />
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/groups">
          <ArrowLeft className="size-4" /> {t("groupDetail.backLink")}
        </Link>
      </Button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl">{group.name}</h1>
            <Tag name={group.scopeTag} />
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <CalendarClock className="size-4" /> {group.schedule}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> {group.location}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="size-4" /> {t("groupDetail.memberCount", { count: group.stats.memberCount })}
            </span>
          </div>
        </div>
        {canUpdate && (
          <div className="flex items-center gap-2">
            <EditGroupDialog
              group={{
                id: group.id,
                name: group.name,
                leaderId: group.leader?.id ?? "",
                scopeTag: group.scopeTag,
                memberIds: group.members.map((m) => m.id),
                schedule: group.schedule,
                location: group.location,
              }}
              trigger={
                <Button variant="outline">
                  <Pencil className="size-4" /> {t("common:actions.edit")}
                </Button>
              }
            />
            <LogAttendanceDialog group={group} />
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("groupDetail.stats.meetingsLogged")} value={group.stats.meetingsLogged} />
        <Stat label={t("groupDetail.stats.avgAttendance")} value={group.stats.avgAttendance} />
        <Stat label={t("groupDetail.stats.members")} value={group.stats.memberCount} />
      </div>

      <Tabs defaultValue="attendance" className="mt-6">
        <TabsList>
          <TabsTrigger value="attendance">{t("groupDetail.tabs.attendance")}</TabsTrigger>
          <TabsTrigger value="members">{t("groupDetail.tabs.members")}</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          {group.sessions.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center">
                {t("groupDetail.noMeetingsLogged")}
              </CardContent>
            </Card>
          )}
          {group.sessions.map((s) => {
            const excusedById = new Map(s.excused.map((e) => [e.memberId, e.reason]))
            const excusedMembers = group.members.filter((m) => excusedById.has(m.id))
            return (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{formatDate(s.date)}</CardTitle>
                    <CardDescription className="mt-1">{s.topic}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {t("groupDetail.presentCount", {
                        present: s.presentIds.length,
                        total: group.stats.memberCount,
                      })}
                    </Badge>
                    {s.excused.length > 0 && (
                      <Badge variant="warning">
                        {t("groupDetail.excusedCount", { count: s.excused.length })}
                      </Badge>
                    )}
                    {canUpdate && (
                      <>
                        <LogAttendanceDialog
                          group={group}
                          session={s}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={t("groupDetail.editSessionLabel", { date: formatDate(s.date) })}
                              title={t("common:actions.edit")}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          }
                        />
                        <DeleteSessionDialog groupId={group.id} session={s} />
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                    {t("groupDetail.attendanceLabel")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.members.map((m) => {
                      const here = s.presentIds.includes(m.id)
                      const excused = excusedById.has(m.id)
                      return (
                        <div
                          key={m.id}
                          title={excused ? excusedById.get(m.id) || t("groupDetail.excused") : undefined}
                          className={
                            "flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-sm " +
                            (here
                              ? "border-primary/30 bg-primary/10"
                              : excused
                                ? "bg-warning-soft text-warning-foreground border-transparent"
                                : "border-border bg-muted/40 text-muted-foreground")
                          }
                        >
                          <MemberAvatar name={m.name} className="size-6" />
                          {m.name.split(" ")[0]}
                          {here ? (
                            <Check className="text-primary size-3.5" />
                          ) : excused ? (
                            <CircleSlash className="size-3.5" aria-label={t("groupDetail.excused")} />
                          ) : (
                            <X className="size-3.5 opacity-50" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {excusedMembers.length > 0 && (
                    <p className="text-muted-foreground mt-2 text-xs">
                      <span className="font-medium">{t("groupDetail.excused")}:</span>{" "}
                      {excusedMembers
                        .map((m) => {
                          const reason = excusedById.get(m.id)
                          return reason ? `${m.name} (${reason})` : m.name
                        })
                        .join(", ")}
                    </p>
                  )}
                </div>
                {s.prayerNotes && (
                  <div className="border-primary/40 bg-muted/30 rounded-md border-l-2 p-3">
                    <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">
                      {t("groupDetail.prayerNotesLabel")}
                    </div>
                    <p className="text-sm">{s.prayerNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            )
          })}
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card className="py-0">
            <CardContent className="divide-y p-0">
              {group.members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 p-3">
                  <MemberAvatar name={m.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      {m.name}
                      {m.id === group.leader?.id && (
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {t("groupDetail.leaderBadge")}
                        </Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">{m.email}</div>
                  </div>
                  <TagList tags={m.tags.filter((t) => t !== "members")} className="hidden md:flex" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function DeleteSessionDialog({ groupId, session }: { groupId: string; session: SessionResponse }) {
  const { t } = useTranslation("groups")
  const deleteSession = useDeleteSession(groupId)
  const [open, setOpen] = useState(false)
  const date = formatDate(session.date)

  const remove = async () => {
    try {
      await deleteSession.mutateAsync(session.id)
      toast(t("groupDetail.deleteSession.successToast", { date }))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("groupDetail.deleteSession.errorToast"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("groupDetail.deleteSession.label", { date })}
          title={t("common:actions.delete")}
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groupDetail.deleteSession.title")}</DialogTitle>
          <DialogDescription>
            {t("groupDetail.deleteSession.description", { date, topic: session.topic || t("logAttendanceDialog.noTopic") })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={remove} disabled={deleteSession.isPending}>
            {deleteSession.isPending ? t("common:actions.deleting") : t("common:actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="font-heading text-2xl font-bold">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </CardContent>
    </Card>
  )
}

function Restricted({ message }: { message: string }) {
  const { t } = useTranslation("groups")
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
        <Lock className="size-6" />
      </div>
      <h2 className="text-xl">{t("groupDetail.restrictedTitle")}</h2>
      <p className="text-muted-foreground mt-2">{message}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/groups">{t("groupDetail.backToGroups")}</Link>
      </Button>
    </div>
  )
}
