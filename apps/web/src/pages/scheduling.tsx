import { useState } from "react"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { MoreHorizontal, Pencil, Settings2, Trash2, X } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { ScheduleEventFormDialog } from "@/components/scheduling/schedule-event-form-dialog"
import { AddInstanceDialog } from "@/components/scheduling/add-instance-dialog"
import { AssignmentCell } from "@/components/scheduling/assignment-cell"
import { useAuth } from "@/lib/auth"
import { useDeleteScheduleEvent, useDeleteServiceInstance, useRoleTemplates, useScheduleEvents } from "@/lib/queries"
import { formatDate } from "@/lib/helpers"

export function SchedulingPage() {
  const { t } = useTranslation("scheduling")
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("scheduling", "create")
  const canManage = hasPermission("scheduling", "update") || hasPermission("scheduling", "delete")
  const { data: events = [], isLoading } = useScheduleEvents()
  const { data: roleTemplates = [] } = useRoleTemplates()
  const [highlightedKey, setHighlightedKey] = useState<string | null>(null)
  const deleteEvent = useDeleteScheduleEvent()
  const deleteInstance = useDeleteServiceInstance()

  const activeRoles = roleTemplates.filter((r) => r.isActive)

  const removeEvent = async (id: string) => {
    try {
      await deleteEvent.mutateAsync(id)
      toast.success(t("toast.eventRemoved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.eventDeleteError"))
    }
  }

  const removeInstance = async (id: string) => {
    try {
      await deleteInstance.mutateAsync(id)
      toast.success(t("toast.instanceRemoved"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.instanceError"))
    }
  }

  return (
    <div>
      <PageHeader
        title={t("page.title")}
        subtitle={t("page.subtitle")}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/scheduling/settings">
                <Settings2 className="size-4" /> {t("page.manageTemplates")}
              </Link>
            </Button>
            {canCreate && <ScheduleEventFormDialog />}
          </div>
        }
      />

      <div className="space-y-6">
        {events.map((event) => (
          <Card key={event.id} className="py-0">
            <CardHeader className="flex flex-row items-start justify-between gap-4 border-b py-4">
              <div>
                <div className="font-medium">{formatDate(event.date)}</div>
                {event.scriptureRef && (
                  <div className="text-muted-foreground text-sm">
                    {t("event.scriptureLabel")}: {event.scriptureRef}
                  </div>
                )}
                {event.theme && <div className="text-sm">{event.theme}</div>}
              </div>
              <div className="flex items-center gap-2">
                {canManage && <AddInstanceDialog event={event} />}
                {canManage && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-7">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <ScheduleEventFormDialog
                        event={event}
                        trigger={
                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Pencil className="size-4" /> {t("menu.edit")}
                          </DropdownMenuItem>
                        }
                      />
                      <DropdownMenuItem variant="destructive" onClick={() => removeEvent(event.id)}>
                        <Trash2 className="size-4" /> {t("menu.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {event.instances.length === 0 ? (
                <div className="text-muted-foreground p-6 text-center text-sm">
                  {t("event.noInstances")}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.role")}</TableHead>
                      {event.instances.map((instance) => (
                        <TableHead key={instance.id}>
                          <span className="flex items-center gap-1">
                            {instance.instanceType.name}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => removeInstance(instance.id)}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                <X className="size-3" />
                              </button>
                            )}
                          </span>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeRoles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="text-muted-foreground font-medium">{role.name}</TableCell>
                        {event.instances.map((instance) => (
                          <TableCell key={instance.id}>
                            <AssignmentCell
                              instanceId={instance.id}
                              roleTemplateId={role.id}
                              roleName={role.name}
                              instanceName={instance.instanceType.name}
                              assignments={instance.assignments.filter(
                                (a) => a.roleTemplateId === role.id,
                              )}
                              canManage={canManage}
                              highlightedKey={highlightedKey}
                              onHighlight={(key) => setHighlightedKey((current) => current === key ? null : key)}
                            />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        ))}
        {!isLoading && events.length === 0 && (
          <div className="text-muted-foreground py-12 text-center">{t("empty")}</div>
        )}
      </div>
    </div>
  )
}
