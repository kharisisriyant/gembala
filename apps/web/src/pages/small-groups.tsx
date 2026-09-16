import { MapPin, CalendarClock, Users, ChevronRight, MoreHorizontal, Pencil } from "lucide-react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { MemberAvatar } from "@/components/member-avatar"
import { Tag } from "@/components/tag"
import { AddGroupDialog } from "@/components/add-group-dialog"
import { EditGroupDialog } from "@/components/edit-group-dialog"
import { AttendanceHeatmap } from "@/components/attendance-heatmap"
import { useAuth } from "@/lib/auth"
import { useGroups } from "@/lib/queries"
import { formatShort } from "@/lib/helpers"

export function SmallGroupsPage() {
  const { me } = useAuth()
  const { data: visibleGroups = [], isLoading } = useGroups()

  return (
    <div>
      <PageHeader
        title="Small Groups"
        subtitle={
          me?.scopeTags
            ? `Groups scoped to #${me.scopeTags.join(" #")}.`
            : "Every komsel and connect group in the church."
        }
        action={<AddGroupDialog />}
      />

      <AttendanceHeatmap />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleGroups.map((g) => (
          <Card key={g.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link to={`/groups/${g.id}`} className="font-heading text-lg font-semibold hover:underline">
                    {g.name}
                  </Link>
                  <div className="text-muted-foreground mt-0.5 text-sm">
                    Led by {g.leader?.name ?? "—"}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tag name={g.scopeTag} />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <EditGroupDialog
                        group={{
                          id: g.id,
                          name: g.name,
                          leaderId: g.leader?.id ?? "",
                          scopeTag: g.scopeTag,
                          memberIds: g.members.map((m) => m.id),
                          schedule: g.schedule,
                          location: g.location,
                        }}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Pencil className="size-4" /> Edit group
                          </DropdownMenuItem>
                        }
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3 text-sm">
              <div className="text-muted-foreground flex items-center gap-2">
                <CalendarClock className="size-4" /> {g.schedule}
              </div>
              <div className="text-muted-foreground flex items-center gap-2">
                <MapPin className="size-4" /> {g.location}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <div className="flex -space-x-2">
                  {g.members.slice(0, 5).map((m) => (
                    <MemberAvatar key={m.id} name={m.name} className="ring-background size-7 ring-2" />
                  ))}
                </div>
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Users className="size-3.5" /> {g.memberCount} members
                </span>
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between border-t">
              <div className="text-muted-foreground text-xs">
                {g.lastSessionDate
                  ? `Last met ${formatShort(g.lastSessionDate)} · ${g.lastSessionPresent ?? 0} came`
                  : "No meetings yet"}
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1">
                <Link to={`/groups/${g.id}`}>
                  Open <ChevronRight className="size-4" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {!isLoading && visibleGroups.length === 0 && (
        <Card>
          <CardContent className="text-muted-foreground py-12 text-center">
            No groups in your scope yet.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
