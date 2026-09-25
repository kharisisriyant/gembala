import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import type { ScheduleEventDetailResponse } from "@gembala/shared"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useCreateServiceInstance, useInstanceTypes } from "@/lib/queries"

export function AddInstanceDialog({ event }: { event: ScheduleEventDetailResponse }) {
  const { t } = useTranslation("scheduling")
  const { data: instanceTypes = [] } = useInstanceTypes()
  const createInstance = useCreateServiceInstance()
  const [open, setOpen] = useState(false)
  const [instanceTypeId, setInstanceTypeId] = useState("")

  const usedTypeIds = new Set(event.instances.map((i) => i.instanceType.id))
  const available = instanceTypes.filter((it) => it.isActive && !usedTypeIds.has(it.id))

  const onOpenChange = (v: boolean) => {
    if (v) setInstanceTypeId(available[0]?.id ?? "")
    setOpen(v)
  }

  const save = async () => {
    try {
      await createInstance.mutateAsync({
        eventId: event.id,
        instanceTypeId,
        sortOrder: event.instances.length,
      })
      toast.success(t("toast.instanceAdded"))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.instanceError"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={available.length === 0}>
          <Plus className="size-4" /> {t("addInstanceDialog.trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("addInstanceDialog.title")}</DialogTitle>
          <DialogDescription>{t("addInstanceDialog.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Select value={instanceTypeId} onValueChange={setInstanceTypeId}>
            <SelectTrigger>
              <SelectValue placeholder={t("addInstanceDialog.typeLabel")} />
            </SelectTrigger>
            <SelectContent>
              {available.map((it) => (
                <SelectItem key={it.id} value={it.id}>
                  {it.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button onClick={save} disabled={!instanceTypeId || createInstance.isPending}>
            {createInstance.isPending ? t("addInstanceDialog.adding") : t("addInstanceDialog.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
