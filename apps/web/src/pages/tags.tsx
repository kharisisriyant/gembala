import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus, MoreHorizontal, CornerDownRight, Hash, Users } from "lucide-react"
import type { TagResponse } from "@gembala/shared"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PageHeader } from "@/components/page-header"
import { Tag } from "@/components/tag"
import { AddTagDialog } from "@/components/add-tag-dialog"
import { useAuth } from "@/lib/auth"
import { useDeleteTag, useTags } from "@/lib/queries"
import { buildForest, type TagNode } from "@/lib/tag-tree"

function TagRow({
  node,
  byName,
  canCreate,
  canDelete,
}: {
  node: TagNode
  byName: Map<string, TagResponse>
  canCreate: boolean
  canDelete: boolean
}) {
  const { t } = useTranslation("tags")
  const deleteTag = useDeleteTag()
  const counts = byName.get(node.name)
  const direct = counts?.directCount ?? 0
  const subtree = counts?.subtreeCount ?? 0
  const isParent = node.children.length > 0

  const remove = async () => {
    try {
      await deleteTag.mutateAsync(node.name)
      toast(t("page.toast.removed", { name: node.name }), {
        description: isParent ? t("page.toast.childrenMoved") : undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("page.toast.deleteError"))
    }
  }

  return (
    <>
      <div
        className="flex items-center gap-3 py-2.5"
        style={{ paddingLeft: node.depth * 28 }}
      >
        {node.depth > 0 && (
          <CornerDownRight className="text-muted-foreground/50 size-4 shrink-0" />
        )}
        <Tag name={node.name} />
        {node.description && (
          <span className="text-muted-foreground hidden truncate text-sm sm:inline">
            {node.description}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Users className="size-3" />
            {direct}
            {isParent && subtree !== direct && (
              <span className="text-muted-foreground">{t("page.row.withChildren", { count: subtree })}</span>
            )}
          </Badge>
          {(canCreate || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canCreate && (
                  <AddTagDialog
                    defaultParent={node.name}
                    trigger={
                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Plus className="size-4" /> {t("page.row.addChild")}
                      </DropdownMenuItem>
                    }
                  />
                )}
                {canDelete && (
                  <DropdownMenuItem variant="destructive" onClick={remove}>
                    {t("page.row.deleteTag")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {node.children.map((c) => (
        <TagRow key={c.name} node={c} byName={byName} canCreate={canCreate} canDelete={canDelete} />
      ))}
    </>
  )
}

export function TagsPage() {
  const { t } = useTranslation("tags")
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("tags", "create")
  const canDelete = hasPermission("tags", "delete")
  const { data: defs = [] } = useTags()
  const forest = buildForest(defs)
  const byName = new Map(defs.map((d) => [d.name, d]))

  return (
    <div>
      <PageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        action={
          canCreate ? (
            <AddTagDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> {t("page.newTag")}
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Hash} label={t("page.stats.totalTags")} value={defs.length} />
        <Stat icon={CornerDownRight} label={t("page.stats.nestedTags")} value={defs.filter((d) => d.parent).length} />
        <Stat icon={Users} label={t("page.stats.topLevelGroups")} value={forest.length} />
      </div>

      <Card className="mt-6 py-2">
        <CardContent className="divide-y px-4">
          {forest.map((node) => (
            <TagRow key={node.name} node={node} byName={byName} canCreate={canCreate} canDelete={canDelete} />
          ))}
        </CardContent>
      </Card>

      <p className="text-muted-foreground mt-4 flex items-start gap-2 text-sm">
        <Hash className="mt-0.5 size-4 shrink-0" />
        <span>
          {t("page.footer.prefix")}{" "}
          <span className="font-mono">#youth</span> {t("page.footer.middle")}
          <span className="font-mono">#teen</span>,{" "}
          <span className="font-mono">#college</span>{t("page.footer.suffix")}
        </span>
      </p>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: number
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-md">
          <Icon className="size-4" />
        </div>
        <div>
          <div className="font-heading text-2xl font-bold leading-none">{value}</div>
          <div className="text-muted-foreground mt-1 text-sm">{label}</div>
        </div>
      </CardContent>
    </Card>
  )
}
