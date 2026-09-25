import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Item = { id: string; name: string; sortOrder: number; isActive: boolean }

export function TemplateListCard({
  section,
  items,
  canManage,
  onCreate,
  onReorder,
  onToggleActive,
}: {
  section: "roleTemplates" | "instanceTypes"
  items: Item[]
  canManage: boolean
  onCreate: (name: string) => Promise<unknown>
  onReorder: (id: string, sortOrder: number) => Promise<unknown>
  onToggleActive: (id: string, isActive: boolean) => Promise<unknown>
}) {
  const { t } = useTranslation("scheduling")
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)

  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder)

  const create = async () => {
    setCreating(true)
    try {
      await onCreate(name)
      setName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.eventError"))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card className="py-0">
      <CardHeader className="border-b py-4">
        <div className="font-medium">{t(`settings.${section}.title`)}</div>
        <div className="text-muted-foreground text-sm">{t(`settings.${section}.subtitle`)}</div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        {canManage && (
          <div className="flex gap-2">
            <Input
              placeholder={t(`settings.${section}.addPlaceholder`)}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button onClick={create} disabled={!name || creating}>
              <Plus className="size-4" /> {t(`settings.${section}.add`)}
            </Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.name")}</TableHead>
              <TableHead className="w-24">#</TableHead>
              <TableHead className="w-28" />
              {canManage && <TableHead className="w-28" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Input
                      type="number"
                      className="h-8 w-16"
                      value={item.sortOrder}
                      onChange={(e) => void onReorder(item.id, Number(e.target.value))}
                    />
                  ) : (
                    item.sortOrder
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={item.isActive ? "success" : "muted"}>
                    {item.isActive
                      ? t(`settings.${section}.statusActive`)
                      : t(`settings.${section}.statusInactive`)}
                  </Badge>
                </TableCell>
                {canManage && (
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void onToggleActive(item.id, !item.isActive)}
                    >
                      {item.isActive
                        ? t(`settings.${section}.deactivate`)
                        : t(`settings.${section}.activate`)}
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {sorted.length === 0 && (
          <div className="text-muted-foreground py-6 text-center text-sm">
            {t(`settings.${section}.empty`)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
