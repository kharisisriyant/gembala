import { Users, Sprout, CalendarCheck, UserPlus, TrendingUp, HeartHandshake } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PageHeader } from "@/components/page-header"
import { MemberAvatar } from "@/components/member-avatar"
import { Tag } from "@/components/tag"
import { useAuth } from "@/lib/auth"
import { useDashboard } from "@/lib/queries"
import { formatShort } from "@/lib/helpers"
import { Link } from "react-router-dom"

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType
  label: string
  value: string | number
  hint: string
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{label}</CardTitle>
        <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="font-heading text-3xl font-bold">{value}</div>
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const { me } = useAuth()
  const { data, isLoading } = useDashboard()

  const firstName = me?.user.name.split(" ")[0] ?? ""

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader
          title={`Welcome back, ${firstName}`}
          subtitle="Here's how your people are doing this week."
        />
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  const maxTag = data.tagHistogram[0]?.count ?? 1

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        subtitle="Here's how your people are doing this week."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Members" value={data.memberCount} hint={`${data.activeCount} active`} />
        <Stat icon={Sprout} label="Small Groups" value={data.groupCount} hint="in your care" />
        <Stat icon={CalendarCheck} label="Avg. attendance" value={data.avgAttendance} hint="per meeting" />
        <Stat icon={UserPlus} label="Newcomers" value={data.newcomerCount} hint="last 60 days" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent group meetings</CardTitle>
              <CardDescription>Attendance & topics from your groups</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/groups">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentSessions.length === 0 && (
              <p className="text-muted-foreground text-sm">No meetings logged yet.</p>
            )}
            {data.recentSessions.map((s) => (
              <Link
                to={`/groups/${s.groupId}`}
                key={s.id}
                className="hover:bg-accent/40 flex items-center gap-4 rounded-lg border p-3 transition-colors"
              >
                <div className="bg-secondary text-secondary-foreground flex w-14 flex-col items-center rounded-md py-1 text-center">
                  <span className="text-xs">{formatShort(s.date).split(" ")[0]}</span>
                  <span className="font-heading text-lg leading-none font-bold">
                    {new Date(s.date + "T00:00:00").getDate()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.groupName}</div>
                  <div className="text-muted-foreground truncate text-sm">{s.topic}</div>
                </div>
                <div className="flex shrink-0 items-center -space-x-2">
                  {s.presentNames.slice(0, 4).map((name) => (
                    <MemberAvatar key={name} name={name} className="ring-background size-7 ring-2" />
                  ))}
                  {s.presentCount > 4 && (
                    <div className="bg-muted text-muted-foreground ring-background flex size-7 items-center justify-center rounded-full text-xs ring-2">
                      +{s.presentCount - 4}
                    </div>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {s.presentCount} came
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="text-primary size-4" /> Tag breakdown
              </CardTitle>
              <CardDescription>Who's in your scope</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.tagHistogram.map(({ tag, count }) => (
                <div key={tag}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <Tag name={tag} />
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <Progress value={(count / maxTag) * 100} className="h-1.5" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartHandshake className="text-primary size-4" /> Latest prayer notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.prayerNotes.map((s, i) => (
                <div key={i} className="border-primary/40 border-l-2 pl-3">
                  <div className="text-muted-foreground text-xs">
                    {s.groupName} · {formatShort(s.date)}
                  </div>
                  <p className="text-sm">{s.notes}</p>
                </div>
              ))}
              {data.prayerNotes.length === 0 && (
                <p className="text-muted-foreground text-sm">No prayer notes yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
