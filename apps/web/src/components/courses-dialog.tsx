import { useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Check, Pencil, Trash2, X } from "lucide-react"
import { courseKindSchema, type CourseKind, type CourseResponse } from "@gembala/shared"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth } from "@/lib/auth"
import { useCourses, useCreateCourse, useDeleteCourse, useUpdateCourse } from "@/lib/queries"

function KindSelect({ value, onChange }: { value: CourseKind; onChange: (k: CourseKind) => void }) {
  const { t } = useTranslation("journey")
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CourseKind)}>
      <SelectTrigger className="w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {courseKindSchema.options.map((k) => (
          <SelectItem key={k} value={k}>
            {t(`courseKind.${k}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function CourseRow({ course, canUpdate, canDelete }: { course: CourseResponse; canUpdate: boolean; canDelete: boolean }) {
  const { t } = useTranslation("journey")
  const update = useUpdateCourse()
  const remove = useDeleteCourse()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(course.name)
  const [kind, setKind] = useState<CourseKind>(course.kind)

  const save = async () => {
    try {
      await update.mutateAsync({ id: course.id, name, kind })
      toast.success(t("courses.updated"))
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courses.updateError"))
    }
  }

  const doDelete = async () => {
    try {
      await remove.mutateAsync(course.id)
      toast(t("courses.deleted"))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courses.deleteError"))
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 rounded-md border p-2">
        <Input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} />
        <KindSelect value={kind} onChange={setKind} />
        <Button size="icon" className="size-8 shrink-0" disabled={!name.trim() || update.isPending} onClick={save}>
          <Check className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 shrink-0"
          onClick={() => {
            setName(course.name)
            setKind(course.kind)
            setEditing(false)
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
      <div className="min-w-0">
        <span className="font-medium">{course.name}</span>{" "}
        <Badge variant="muted">{t(`courseKind.${course.kind}`)}</Badge>
        <div className="text-muted-foreground text-xs">
          {t("courses.enrollments", { count: course.enrollmentCount })}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {canUpdate && (
          <Button variant="ghost" size="icon" className="size-7" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
        )}
        {canDelete && (
          <Button variant="ghost" size="icon" className="size-7" onClick={doDelete}>
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

// Admin-facing catalog editor: the courses members can be enrolled in.
export function CoursesDialog({ trigger }: { trigger: React.ReactNode }) {
  const { t } = useTranslation("journey")
  const { hasPermission } = useAuth()
  const { data: courses = [] } = useCourses()
  const create = useCreateCourse()
  const [name, setName] = useState("")
  const [kind, setKind] = useState<CourseKind>("discipleship")

  const add = async () => {
    try {
      await create.mutateAsync({ name, kind })
      toast.success(t("courses.added"))
      setName("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("courses.addError"))
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("courses.title")}</DialogTitle>
          <DialogDescription>{t("courses.description")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {courses.map((c) => (
            <CourseRow
              key={c.id}
              course={c}
              canUpdate={hasPermission("courses", "update")}
              canDelete={hasPermission("courses", "delete")}
            />
          ))}
          {courses.length === 0 && <p className="text-muted-foreground text-sm">{t("courses.empty")}</p>}
        </div>
        {hasPermission("courses", "create") && (
          <div className="grid gap-2 border-t pt-4">
            <Label htmlFor="course-name">{t("courses.name")}</Label>
            <div className="flex gap-2">
              <Input
                id="course-name"
                value={name}
                maxLength={100}
                placeholder={t("courses.namePlaceholder")}
                onChange={(e) => setName(e.target.value)}
              />
              <KindSelect value={kind} onChange={setKind} />
              <Button onClick={add} disabled={!name.trim() || create.isPending}>
                {t("courses.add")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
