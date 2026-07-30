import { Link, useParams } from "react-router-dom"
import {
  ArrowLeft,
  MapPin,
  CalendarClock,
  Users,
  Check,
  X,
  Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MemberAvatar } from "@/components/member-avatar"
import { Tag, TagList } from "@/components/tag"
import { LogAttendanceDialog } from "@/components/log-attendance-dialog"
import { useGroup } from "@/lib/queries"
import { ApiError } from "@/lib/api"
import { formatDate } from "@/lib/helpers"

export function GroupDetailPage() {
  const { id } = useParams()
  const { data: group, isLoading, error } = useGroup(id)

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }
  if (error instanceof ApiError && error.status === 403) {
    return <Restricted message="This group is outside your access." />
  }
  if (error || !group) {
    return <Restricted message="This group doesn't exist." />
  }

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/groups">
          <ArrowLeft className="size-4" /> Small Groups
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
              <Users className="size-4" /> {group.stats.memberCount} members
            </span>
          </div>
        </div>
        <LogAttendanceDialog group={group} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Meetings logged" value={group.stats.meetingsLogged} />
        <Stat label="Avg. attendance" value={group.stats.avgAttendance} />
        <Stat label="Members" value={group.stats.memberCount} />
      </div>

      <Tabs defaultValue="attendance" className="mt-6">
        <TabsList>
          <TabsTrigger value="attendance">Attendance history</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="mt-4 space-y-4">
          {group.sessions.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground py-10 text-center">
                No meetings logged yet. Use “Log attendance” to record one.
              </CardContent>
            </Card>
          )}
          {group.sessions.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{formatDate(s.date)}</CardTitle>
                    <CardDescription className="mt-1">{s.topic}</CardDescription>
                  </div>
                  <Badge variant="secondary">
                    {s.presentIds.length}/{group.stats.memberCount} present
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">Attendance</div>
                  <div className="flex flex-wrap gap-2">
                    {group.members.map((m) => {
                      const here = s.presentIds.includes(m.id)
                      return (
                        <div
                          key={m.id}
                          className={
                            "flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-sm " +
                            (here
                              ? "border-primary/30 bg-primary/10"
                              : "border-border bg-muted/40 text-muted-foreground")
                          }
                        >
                          <MemberAvatar name={m.name} className="size-6" />
                          {m.name.split(" ")[0]}
                          {here ? (
                            <Check className="text-primary size-3.5" />
                          ) : (
                            <X className="size-3.5 opacity-50" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
                {s.prayerNotes && (
                  <div className="border-primary/40 bg-muted/30 rounded-md border-l-2 p-3">
                    <div className="text-muted-foreground mb-1 text-xs font-medium uppercase">Prayer notes</div>
                    <p className="text-sm">{s.prayerNotes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
                        <Badge variant="outline" className="border-primary/30 text-primary">leader</Badge>
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
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <div className="bg-muted text-muted-foreground mx-auto mb-4 flex size-14 items-center justify-center rounded-full">
        <Lock className="size-6" />
      </div>
      <h2 className="text-xl">Restricted</h2>
      <p className="text-muted-foreground mt-2">{message}</p>
      <Button asChild variant="outline" className="mt-4">
        <Link to="/groups">Back to Small Groups</Link>
      </Button>
    </div>
  )
}
