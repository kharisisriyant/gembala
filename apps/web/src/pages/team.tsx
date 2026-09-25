import { useState } from "react"
import { Pencil } from "lucide-react"
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
import { PageHeader } from "@/components/page-header"
import { TeamRolesDialog } from "@/components/team-roles-dialog"
import { useTeam } from "@/lib/queries"
import type { TeamMemberResponse } from "@gembala/shared"

export function TeamPage() {
  const { data: team = [], isLoading } = useTeam()
  const [editing, setEditing] = useState<TeamMemberResponse | null>(null)

  return (
    <div>
      <PageHeader title="Team" subtitle="Everyone with access to this organization, and their roles." />

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((m) => (
                <TableRow key={m.membershipId}>
                  <TableCell className="font-medium">{m.user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{m.user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.roles.map((r) => (
                        <Badge key={r.id} variant="secondary">
                          {r.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {m.scopeTags === null ? "Full access" : m.scopeTags.join(", ") || "None"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(m)}>
                      <Pencil className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && team.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">No team members yet.</div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <TeamRolesDialog
          member={editing}
          open={Boolean(editing)}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  )
}
