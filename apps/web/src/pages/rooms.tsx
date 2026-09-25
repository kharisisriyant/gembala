import { toast } from "sonner"
import { MoreHorizontal, Pencil, Trash2, Users2 } from "lucide-react"
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
import { AddRoomDialog } from "@/components/add-room-dialog"
import { EditRoomDialog } from "@/components/edit-room-dialog"
import { useAuth } from "@/lib/auth"
import { useDeleteRoom, useRooms } from "@/lib/queries"

export function RoomsPage() {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("rooms", "create")
  const canManage = hasPermission("rooms", "update") || hasPermission("rooms", "delete")
  const { data: rooms = [], isLoading } = useRooms()
  const deleteRoom = useDeleteRoom()

  const remove = async (id: string, name: string) => {
    try {
      await deleteRoom.mutateAsync(id)
      toast(`${name} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete room")
    }
  }

  return (
    <div>
      <PageHeader
        title="Rooms"
        subtitle="Physical spaces events can be booked into."
        action={canCreate ? <AddRoomDialog /> : undefined}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.capacity ? (
                      <span className="flex items-center gap-1">
                        <Users2 className="size-3.5" /> {r.capacity}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate whitespace-normal">
                    {r.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.isActive ? "success" : "muted"}>
                      {r.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <EditRoomDialog
                            room={r}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Pencil className="size-4" /> Edit room
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem variant="destructive" onClick={() => remove(r.id, r.name)}>
                            <Trash2 className="size-4" /> Delete room
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && rooms.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">No rooms yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
