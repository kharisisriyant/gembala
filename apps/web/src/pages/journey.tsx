import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Settings2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/page-header"
import { TagList } from "@/components/tag"
import { CoursesDialog } from "@/components/courses-dialog"
import { JourneyStagesDialog } from "@/components/journey-stages-dialog"
import { useAuth } from "@/lib/auth"
import { useJourneyStages, usePipeline } from "@/lib/queries"

export function JourneyPage() {
  const { t } = useTranslation("journey")
  const { hasPermission } = useAuth()
  const { data: stages = [] } = useJourneyStages()
  const [stageId, setStageId] = useState("")
  useEffect(() => { if (!stageId && stages[0]) setStageId(stages[0].id) }, [stageId, stages])
  const stage = stages.find((s) => s.id === stageId)
  const { data: rows = [], isLoading } = usePipeline(stageId || "00000000-0000-0000-0000-000000000000")

  const showCourse = stage?.rule === "course_completed"
  const showLeadership = stage?.rule === "leadership_ready"

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex gap-2">
            {hasPermission("courses", "read") && <CoursesDialog trigger={<Button variant="outline"><Settings2 className="size-4" /> {t("manageCourses")}</Button>} />}
            {hasPermission("journey", "delete") && <JourneyStagesDialog trigger={<Button variant="outline"><Settings2 className="size-4" /> {t("manageStages")}</Button>} />}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Tabs value={stageId} onValueChange={setStageId}>
          <TabsList>
            {stages.filter((s) => s.active).map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">{stage?.description || t("stageHelp.manual")}</p>

      <Card className="py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.member")}</TableHead>
                <TableHead>{t("table.tags")}</TableHead>
                {showCourse && <TableHead>{t("table.course")}</TableHead>}
                {showLeadership && <TableHead>{t("table.leadership")}</TableHead>}
                <TableHead>{t("table.waiting")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.memberId}>
                  <TableCell className="font-medium">{r.memberName}</TableCell>
                  <TableCell className="whitespace-normal">
                    <TagList tags={r.tags} />
                  </TableCell>
                  {showCourse && <TableCell>{r.courseName}</TableCell>}
                  {showLeadership && (
                    <TableCell>
                      {r.leadership && (
                        <div className="flex items-center gap-2">
                          <Badge variant="success">{t(`level.${r.leadership.level}`)}</Badge>
                          <span className="text-sm">{t(`targetRole.${r.leadership.targetRole}`)}</span>
                        </div>
                      )}
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground text-sm">
                    {r.daysSince === null ? "—" : t("days", { count: r.daysSince })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!isLoading && rows.length === 0 && (
            <div className="text-muted-foreground py-12 text-center">{t("empty")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
