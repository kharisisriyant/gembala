import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Settings2 } from "lucide-react"
import { pipelineStageSchema, type PipelineStage } from "@gembala/shared"
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
import { useAuth } from "@/lib/auth"
import { usePipeline } from "@/lib/queries"

const DEFAULT_FOLLOW_UP_DAYS = 30

export function JourneyPage() {
  const { t } = useTranslation("journey")
  const { hasPermission } = useAuth()
  const [stage, setStage] = useState<PipelineStage>("newcomer_followup")
  const [followUpDays, setFollowUpDays] = useState(DEFAULT_FOLLOW_UP_DAYS)
  const { data: rows = [], isLoading } = usePipeline(stage, followUpDays)

  const showCourse = stage === "baptism_ready" || stage === "sidi_ready"
  const showLeadership = stage === "leader_candidate"

  return (
    <div>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          hasPermission("courses", "read") ? (
            <CoursesDialog
              trigger={
                <Button variant="outline">
                  <Settings2 className="size-4" /> {t("manageCourses")}
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <Tabs value={stage} onValueChange={(v) => setStage(v as PipelineStage)}>
          <TabsList>
            {pipelineStageSchema.options.map((s) => (
              <TabsTrigger key={s} value={s}>
                {t(`stage.${s}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {stage === "newcomer_followup" && (
          <div className="flex items-center gap-2">
            <Label htmlFor="follow-up-days" className="text-sm whitespace-nowrap">
              {t("followUpAfter")}
            </Label>
            <Input
              id="follow-up-days"
              type="number"
              min={1}
              max={365}
              className="w-20"
              value={followUpDays}
              onChange={(e) => {
                const n = Math.floor(Number(e.target.value))
                if (n >= 1 && n <= 365) setFollowUpDays(n)
              }}
            />
          </div>
        )}
      </div>
      <p className="text-muted-foreground mb-4 text-sm">{t(`stageHelp.${stage}`)}</p>

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
