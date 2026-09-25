import { useMemo, useState } from "react"
import { Search, UserPlus, Phone, Mail, Pencil, Upload } from "lucide-react"
import { useTranslation } from "react-i18next"
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
import { ImportMembersDialog } from "@/components/import-members-dialog"
import { useAuth } from "@/lib/auth"
import { useGroups, useMember, useMembers } from "@/lib/queries"
import { formatDate } from "@/lib/helpers"

const statusVariant: Record<
  MemberResponse["status"],
  "success" | "info" | "muted"
> = {
  active: "success",
  newcomer: "info",
  inactive: "muted",
  moved: "muted",
}

export function MembersPage() {
  const { t } = useTranslation("members")
  const { me, hasPermission } = useAuth()
  const canCreate = hasPermission("members", "create")
  const canUpdate = hasPermission("members", "update")
  const { data: visibleMembers = [], isLoading } = useMembers()
  const { data: groups = [] } = useGroups()
  const [query, setQuery] = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { data: selected } = useMember(selectedId)

  const statusLabel: Record<MemberResponse["status"], string> = {
    active: t("status.active"),
    newcomer: t("status.newcomer"),
    inactive: t("status.inactive"),
    moved: t("status.moved"),
  }
  const genderLabel: Record<string, string> = {
    male: t("options.gender.male"),
    female: t("options.gender.female"),
  }
  const maritalStatusLabel: Record<string, string> = {
    single: t("options.maritalStatus.single"),
    married: t("options.maritalStatus.married"),
    widowed: t("options.maritalStatus.widowed"),
    divorced: t("options.maritalStatus.divorced"),
  }
  const baptismStatusLabel: Record<string, string> = {
    not_baptized: t("options.baptismStatus.notBaptized"),
    baptized: t("options.baptismStatus.baptized"),
  }

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
        title={t("page.title")}
        subtitle={
          me?.scopeTags
            ? t("page.subtitleScoped", { tags: me.scopeTags.join(" #") })
            : t("page.subtitleAll")
        }
        action={
          canCreate ? (
            <div className="flex items-center gap-2">
              <ImportMembersDialog
                trigger={
                  <Button variant="outline">
                    <Upload className="size-4" /> {t("actions.importCsv")}
                  </Button>
                }
              />
              <AddMemberDialog trigger={<Button><UserPlus className="size-4" /> {t("actions.addMember")}</Button>} />
            </div>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            placeholder={t("search.placeholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-sm">{t("filter.label")}</span>
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
              <TableHead>{t("table.member")}</TableHead>
              <TableHead className="hidden lg:table-cell">{t("table.tags")}</TableHead>
              <TableHead className="hidden md:table-cell">{t("table.groups")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="hidden xl:table-cell">{t("table.joined")}</TableHead>
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
                  <Badge variant={statusVariant[m.status]}>{statusLabel[m.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-sm xl:table-cell">
                  {formatDate(m.joinedAt)}
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  {t("table.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="text-muted-foreground mt-3 text-sm">
        {t("summary", { filtered: filtered.length, total: visibleMembers.length })}
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
                        {t("detail.memberSince", { date: formatDate(selected.joinedAt) })}
                      </SheetDescription>
                    </div>
                  </div>
                  {canUpdate && (
                    <EditMemberDialog
                      member={selected}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Pencil className="size-4" /> {t("common:actions.edit")}
                        </Button>
                      }
                    />
                  )}
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
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">{t("detail.tags")}</div>
                  <TagList tags={selected.tags} />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                  <div>
                    <div className="text-muted-foreground text-xs">{t("detail.dateOfBirth")}</div>
                    <div>{selected.dateOfBirth ? formatDate(selected.dateOfBirth) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t("detail.gender")}</div>
                    <div>{selected.gender ? genderLabel[selected.gender] : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t("detail.maritalStatus")}</div>
                    <div>{selected.maritalStatus ? maritalStatusLabel[selected.maritalStatus] : "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t("detail.occupation")}</div>
                    <div>{selected.occupation || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground text-xs">{t("detail.baptism")}</div>
                    <div>
                      {selected.baptismStatus ? baptismStatusLabel[selected.baptismStatus] : "—"}
                      {selected.baptismDate ? ` · ${formatDate(selected.baptismDate)}` : ""}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-muted-foreground text-xs">{t("detail.address")}</div>
                    <div className="whitespace-pre-wrap">{selected.address || "—"}</div>
                  </div>
                  {selected.notes && (
                    <div className="col-span-2">
                      <div className="text-muted-foreground text-xs">{t("detail.notes")}</div>
                      <div className="whitespace-pre-wrap">{selected.notes}</div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-muted-foreground mb-2 text-xs font-medium uppercase">{t("detail.smallGroups")}</div>
                  <div className="space-y-2">
                    {selected.groups.map((g) => (
                      <div key={g.id} className="rounded-md border p-2 text-sm">
                        <div className="font-medium">{g.name}</div>
                      </div>
                    ))}
                    {selected.groups.length === 0 && (
                      <p className="text-muted-foreground text-sm">{t("detail.noGroups")}</p>
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
