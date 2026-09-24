import { useMemo, useState } from "react"
import { Search, UserPlus, Phone, Mail, Pencil } from "lucide-react"
import type { MemberResponse } from "@gembala/shared"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { PageHeader } from "@/components/page-header"
import { MemberAvatar } from "@/components/member-avatar"
import { Tag, TagList } from "@/components/tag"
import { AddMemberDialog } from "@/components/add-member-dialog"
import { EditMemberDialog } from "@/components/edit-member-dialog"
import { useAuth } from "@/lib/auth"
import { useGroups, useMember, useMembers } from "@/lib/queries"
import { formatDate } from "@/lib/helpers"

const statusStyles: Record<MemberResponse["status"], string> = {
  active: "bg-primary/15 text-primary border-primary/20",
  newcomer: "bg-accent text-accent-foreground border-accent",
  inactive: "bg-muted text-muted-foreground border-border",
  moved: "bg-muted text-muted-foreground border-border",
}

export function MembersPage() {
  const { me } = useAuth()
  const { data: visibleMembers = [], isLoading } = useMembers()
  const { data: groups = [] } = useGroups()
  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: selected } = useMember(selectedId)

  const allTags = useMemo(() => {
    const s = new Set<string>()
    visibleMembers.forEach((m) => m.tags.forEach((t) => s.add(t)))
    return [...s].sort()
  }, [visibleMembers])

  const filtered = visibleMembers.filter((m) => {
    const q = query.toLowerCase()
    const matchesQuery =
      !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    const matchesTag = !activeTag || m.tags.includes(activeTag)
    return matchesQuery && matchesTag
  })

  const groupCountOf = (id: string) =>
    groups.filter((g) => g.members.some((m) => m.id === id)).length

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={
          me?.scopeTags
            ? `You can see members tagged #${me.scopeTags.join(" #")}.`
            : "Everyone in the church directory."
        }
        action={<AddMemberDialog trigger={<Button><UserPlus className="size-4" /> Add member</Button>} />}
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-sm">Filter:</span>
          <Tag name="all" onClick={() => setActiveTag(null)} active={activeTag === null} />
          {allTags
            .filter((t) => t !== "members")
            .map((t) => (
              <Tag
                key={t}
                name={t}
                onClick={() => setActiveTag(activeTag === t ? null : t)}
                active={activeTag === t}
              />
            ))}
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Member</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead className="hidden md:table-cell">Groups</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden xl:table-cell">Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((m) => (
              <TableRow
                key={m.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(m.id)}
              >
                <TableCell>
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={m.name} photoUrl={m.photoUrl} />
                    <div className="leading-tight">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-muted-foreground text-xs">{m.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <TagList tags={m.tags.filter((t) => t !== "members")} />
                </TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {groupCountOf(m.id)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusStyles[m.status]}>
                    {m.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm xl:table-cell">
                  {formatDate(m.joinedAt)}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  No members match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-muted-foreground mt-3 text-sm">
        Showing {filtered.length} of {visibleMembers.length} members
      </p>

      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MemberAvatar name={selected.name} photoUrl={selected.photoUrl} className="size-12" />
                    <div>
                      <SheetTitle>{selected.name}</SheetTitle>
                      <SheetDescription>
                        Member since {formatDate(selected.joinedAt)}
                      </SheetDescription>
                    </div>
                  </div>
                  <EditMemberDialog
                    member={selected}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="size-4" /> Edit
                      </Button>
                    }
                  />
                </div>
              </SheetHeader>
              <div className="space-y-6 px-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="text-muted-foreground size-4" /> {selected.email || "—"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="text-muted-foreground size-4" /> {selected.phone || "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">Tags</div>
                  <TagList tags={selected.tags} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">Date of birth</div>
                    <div>{selected.dateOfBirth ? formatDate(selected.dateOfBirth) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Gender</div>
                    <div className="capitalize">{selected.gender ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Marital status</div>
                    <div className="capitalize">{selected.maritalStatus ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Occupation</div>
                    <div>{selected.occupation || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">Baptism</div>
                    <div className="capitalize">
                      {selected.baptismStatus?.replace("_", " ") ?? "—"}
                      {selected.baptismDate ? ` · ${formatDate(selected.baptismDate)}` : ""}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-xs">Address</div>
                    <div className="whitespace-pre-wrap">{selected.address || "—"}</div>
                  </div>
                  {selected.notes && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground text-xs">Notes</div>
                      <div className="whitespace-pre-wrap">{selected.notes}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">Small groups</div>
                  <div className="space-y-2">
                    {selected.groups.map((g) => (
                      <div key={g.id} className="rounded-md border p-2 text-sm">
                        <div className="font-medium">{g.name}</div>
                      </div>
                    ))}
                    {selected.groups.length === 0 && (
                      <p className="text-muted-foreground text-sm">Not in any group yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
