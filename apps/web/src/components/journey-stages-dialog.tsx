import { useState } from "react"
import { Check, Pencil, Plus, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { courseKindSchema, journeyStageRuleSchema, type CourseKind, type JourneyStageResponse, type JourneyStageRule } from "@gembala/shared"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCreateJourneyStage, useDeleteJourneyStage, useJourneyStages, useUpdateJourneyStage } from "@/lib/queries"

function StageRow({ stage }: { stage: JourneyStageResponse }) {
  const { t } = useTranslation("journey")
  const update = useUpdateJourneyStage(); const remove = useDeleteJourneyStage()
  const [editing, setEditing] = useState(false); const [name, setName] = useState(stage.name); const [rule, setRule] = useState<JourneyStageRule>(stage.rule); const [courseKind, setCourseKind] = useState<CourseKind>(stage.courseKind ?? "baptism_prep"); const [days, setDays] = useState(stage.reminderDays)
  const save = async () => { try { await update.mutateAsync({ id: stage.id, name, rule, reminderDays: days, courseKind: rule === "course_completed" ? courseKind : undefined }); setEditing(false); toast.success(t("stages.updated")) } catch (e) { toast.error(e instanceof Error ? e.message : t("stages.error")) } }
  if (editing) return <div className="flex flex-wrap gap-2 rounded-md border p-2"><Input className="w-40" value={name} onChange={(e) => setName(e.target.value)} /><RuleSelect value={rule} onChange={setRule} />{rule === "course_completed" && <CourseKindSelect value={courseKind} onChange={setCourseKind} />}<Input className="w-20" type="number" min={0} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} /><Button size="icon" onClick={save} disabled={!name.trim()}><Check className="size-4" /></Button><Button size="icon" variant="ghost" onClick={() => setEditing(false)}><X className="size-4" /></Button></div>
  return <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm"><div><div className="font-medium">{stage.name}</div><div className="text-muted-foreground">{t(`stageRule.${stage.rule}`)} · {t("stages.days", { count: stage.reminderDays })}</div></div><div className="flex"><Button size="icon" variant="ghost" onClick={() => setEditing(true)}><Pencil className="size-4" /></Button><Button size="icon" variant="ghost" onClick={async () => { try { await remove.mutateAsync(stage.id); toast.success(t("stages.deleted")) } catch (e) { toast.error(e instanceof Error ? e.message : t("stages.error")) } }}><Trash2 className="size-4" /></Button></div></div>
}

function RuleSelect({ value, onChange }: { value: JourneyStageRule; onChange: (value: JourneyStageRule) => void }) { const { t } = useTranslation("journey"); return <Select value={value} onValueChange={(v) => onChange(v as JourneyStageRule)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{journeyStageRuleSchema.options.map((r) => <SelectItem key={r} value={r}>{t(`stageRule.${r}`)}</SelectItem>)}</SelectContent></Select> }
function CourseKindSelect({ value, onChange }: { value: CourseKind; onChange: (value: CourseKind) => void }) { const { t } = useTranslation("journey"); return <Select value={value} onValueChange={(v) => onChange(v as CourseKind)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{courseKindSchema.options.map((k) => <SelectItem key={k} value={k}>{t(`courseKind.${k}`)}</SelectItem>)}</SelectContent></Select> }

export function JourneyStagesDialog({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation("journey"); const { data: stages = [] } = useJourneyStages(); const create = useCreateJourneyStage(); const [name, setName] = useState(""); const [rule, setRule] = useState<JourneyStageRule>("manual"); const [courseKind, setCourseKind] = useState<CourseKind>("baptism_prep"); const [days, setDays] = useState(0)
  const add = async () => { try { await create.mutateAsync({ name, rule, courseKind: rule === "course_completed" ? courseKind : undefined, reminderDays: days, sortOrder: stages.length }); setName(""); setRule("manual"); setDays(0); toast.success(t("stages.added")) } catch (e) { toast.error(e instanceof Error ? e.message : t("stages.error")) } }
  return <Dialog><DialogTrigger asChild>{trigger}</DialogTrigger><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{t("stages.title")}</DialogTitle><DialogDescription>{t("stages.description")}</DialogDescription></DialogHeader><div className="space-y-2">{stages.map((stage) => <StageRow key={stage.id} stage={stage} />)}</div><div className="flex flex-wrap gap-2 border-t pt-4"><Input className="w-40" value={name} placeholder={t("stages.name")} onChange={(e) => setName(e.target.value)} /><RuleSelect value={rule} onChange={setRule} />{rule === "course_completed" && <CourseKindSelect value={courseKind} onChange={setCourseKind} />}<Input className="w-20" type="number" min={0} max={365} value={days} onChange={(e) => setDays(Number(e.target.value))} /><Button onClick={add} disabled={!name.trim() || create.isPending}><Plus className="size-4" /> {t("stages.add")}</Button></div></DialogContent></Dialog>
}
