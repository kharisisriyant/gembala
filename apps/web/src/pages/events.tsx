import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { MoreHorizontal, Pencil, Trash2, MapPin, Globe } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { AddEventDialog } from "@/components/add-event-dialog"
import { EditEventDialog } from "@/components/edit-event-dialog"
import { useAuth } from "@/lib/auth"
import { useDeleteEvent, useEvents } from "@/lib/queries"
import { formatDateTime } from "@/lib/helpers"

export function EventsPage() {
  const { t } = useTranslation("events")
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("events", "create")
  const canManage = hasPermission("events", "update") || hasPermission("events", "delete")
  const { data: events = [], isLoading } = useEvents()
  const deleteEvent = useDeleteEvent()

  const remove = async (id: string, title: string) => {
    try {
      await deleteEvent.mutateAsync(id)
      toast(t("toast.removed", { title }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.deleteError"))
    }
  }

  return (
    <div>
      <PageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        action={canCreate ? <AddEventDialog /> : undefined}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.event")}</TableHead>
                <TableHead>{t("table.starts")}</TableHead>
                <TableHead>{t("table.ends")}</TableHead>
                <TableHead>{t("table.room")}</TableHead>
                <TableHead>{t("table.visibility")}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(e.startAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDateTime(e.endAt)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.room ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5" /> {e.room.name}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {e.isPublic ? (
                      <Badge variant="info" className="gap-1">
                        <Globe className="size-3" /> {t("visibility.public")}
                      </Badge>
                    ) : (
                      <Badge variant="muted">{t("visibility.internal")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <EditEventDialog
                            event={e}
                            trigger={
                              <DropdownMenuItem onSelect={(ev) => ev.preventDefault()}>
                                <Pencil className="size-4" /> {t("actions.editEvent")}
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem variant="destructive" onClick={() => remove(e.id, e.title)}>
                            <Trash2 className="size-4" /> {t("actions.deleteEvent")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && events.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">{t("empty")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
