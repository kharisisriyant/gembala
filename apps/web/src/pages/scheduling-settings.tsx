import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { TemplateListCard } from "@/components/scheduling/template-list-card"
import { useAuth } from "@/lib/auth"
import {
  useCreateInstanceType,
  useCreateRoleTemplate,
  useInstanceTypes,
  useRoleTemplates,
  useUpdateInstanceType,
  useUpdateRoleTemplate,
} from "@/lib/queries"

export function SchedulingSettingsPage() {
  const { t } = useTranslation("scheduling")
  const { hasPermission } = useAuth()
  const canManage = hasPermission("scheduling", "update") || hasPermission("scheduling", "create")

  const { data: roleTemplates = [] } = useRoleTemplates()
  const { data: instanceTypes = [] } = useInstanceTypes()
  const createRoleTemplate = useCreateRoleTemplate()
  const updateRoleTemplate = useUpdateRoleTemplate()
  const createInstanceType = useCreateInstanceType()
  const updateInstanceType = useUpdateInstanceType()

  return (
    <div>
      <PageHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        action={
          <Button variant="outline" asChild>
            <Link to="/scheduling">
              <ArrowLeft className="size-4" /> {t("settings.back")}
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <TemplateListCard
          section="roleTemplates"
          items={roleTemplates}
          canManage={canManage}
          onCreate={(name) =>
            createRoleTemplate.mutateAsync({ name, sortOrder: roleTemplates.length })
          }
          onReorder={(id, sortOrder) => updateRoleTemplate.mutateAsync({ id, sortOrder })}
          onToggleActive={(id, isActive) => updateRoleTemplate.mutateAsync({ id, isActive })}
        />
        <TemplateListCard
          section="instanceTypes"
          items={instanceTypes}
          canManage={canManage}
          onCreate={(name) =>
            createInstanceType.mutateAsync({ name, sortOrder: instanceTypes.length })
          }
          onReorder={(id, sortOrder) => updateInstanceType.mutateAsync({ id, sortOrder })}
          onToggleActive={(id, isActive) => updateInstanceType.mutateAsync({ id, isActive })}
        />
      </div>
    </div>
  )
}
