import { toast } from "sonner"
import { MoreHorizontal, Pencil, Trash2, ShieldCheck } from "lucide-react"
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
import { RoleFormDialog } from "@/components/role-form-dialog"
import { useDeleteRole, useRoles } from "@/lib/queries"

export function RolesPage() {
  const { data: roles = [], isLoading } = useRoles()
  const deleteRole = useDeleteRole()

  const remove = async (id: string, name: string) => {
    try {
      await deleteRole.mutateAsync(id)
      toast(`${name} removed`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete role")
    }
  }

  return (
    <div>
      <PageHeader
        title="Roles"
        subtitle="Define what each role can do. Assign roles to people from the Team page."
        action={<RoleFormDialog />}
      />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-1.5">
                      {r.isSystemAdmin && <ShieldCheck className="text-primary size-4" />}
                      {r.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {r.description || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.isSystemAdmin ? "All" : r.permissions.length}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{r.memberCount}</Badge>
                  </TableCell>
                  <TableCell>
                    {!r.isSystemAdmin && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-7">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <RoleFormDialog
                            role={r}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Pencil className="size-4" /> Edit role
                              </DropdownMenuItem>
                            }
                          />
                          <DropdownMenuItem variant="destructive" onClick={() => remove(r.id, r.name)}>
                            <Trash2 className="size-4" /> Delete role
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && roles.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">No roles yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
