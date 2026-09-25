import { Users, Sprout, CalendarCheck, UserPlus, TrendingUp, HeartHandshake } from "lucide-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation("dashboard")
  const { me } = useAuth()
  const { data, isLoading } = useDashboard()

  const firstName = me?.user.name.split(" ")[0] ?? ""

  if (isLoading || !data) {
    return (
      <div>
        <PageHeader title={t("welcome", { name: firstName })} subtitle={t("subtitle")} />
        <p className="text-muted-foreground text-sm">{t("loading")}</p>
      </div>
    )
  }

  const maxTag = data.tagHistogram[0]?.count ?? 1

  return (
    <div>
      <PageHeader title={t("welcome", { name: firstName })} subtitle={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Users}
          label={t("stats.members")}
          value={data.memberCount}
          hint={t("stats.membersHint", { count: data.activeCount })}
        />
        <Stat
          icon={Sprout}
          label={t("stats.groups")}
          value={data.groupCount}
          hint={t("stats.groupsHint")}
        />
        <Stat
          icon={CalendarCheck}
          label={t("stats.avgAttendance")}
          value={data.avgAttendance}
          hint={t("stats.avgAttendanceHint")}
        />
        <Stat
          icon={UserPlus}
          label={t("stats.newcomers")}
          value={data.newcomerCount}
          hint={t("stats.newcomersHint")}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t("recentMeetings.title")}</CardTitle>
              <CardDescription>{t("recentMeetings.subtitle")}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/groups">{t("recentMeetings.viewAll")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.recentSessions.length === 0 && (
              <p className="text-muted-foreground text-sm">{t("recentMeetings.empty")}</p>
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
                  {t("recentMeetings.came", { count: s.presentCount })}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="text-primary size-4" /> {t("tagBreakdown.title")}
              </CardTitle>
              <CardDescription>{t("tagBreakdown.subtitle")}</CardDescription>
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
                <HeartHandshake className="text-primary size-4" /> {t("prayerNotes.title")}
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
                <p className="text-muted-foreground text-sm">{t("prayerNotes.empty")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
