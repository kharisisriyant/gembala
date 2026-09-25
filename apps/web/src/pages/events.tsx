import { toast } from "sonner"
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
import { useDeleteEvent, useEvents } from "@/lib/queries"
import { formatDateTime } from "@/lib/helpers"

export function EventsPage() {
  const { data: events = [], isLoading } = useEvents()
  const deleteEvent = useDeleteEvent()

  const remove = async (id: string, title: string) => {
    try {
      await deleteEvent.mutateAsync(id)
      toast(`${title} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete event")
    }
  }

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Upcoming and past events, optionally booked into a room."
        action={<AddEventDialog />}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Starts</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Visibility</TableHead>
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
                        <Globe className="size-3" /> Public
                      </Badge>
                    ) : (
                      <Badge variant="muted">Internal</Badge>
                    )}
                  </TableCell>
                  <TableCell>
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
                              <Pencil className="size-4" /> Edit event
                            </DropdownMenuItem>
                          }
                        />
                        <DropdownMenuItem variant="destructive" onClick={() => remove(e.id, e.title)}>
                          <Trash2 className="size-4" /> Delete event
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && events.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">No events yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
