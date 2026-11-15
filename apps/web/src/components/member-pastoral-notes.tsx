import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Lock, Pencil, Send, Trash2 } from "lucide-react"
import type { PastoralNoteResponse } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
import { useAuth } from "@/lib/auth"
import {
  useCreatePastoralNote,
  useDeletePastoralNote,
  useMemberPastoralNotes,
  useUpdatePastoralNote,
} from "@/lib/queries"
import { formatDateTime } from "@/lib/helpers"

const MAX_BODY = 5000

// "Pastoral notes" section of the member detail sheet. The API only returns the
// caller's own notes (admins see all), so nothing here filters by author.
// Render with key={memberId} so the draft resets when another member is opened.
export function MemberPastoralNotes({ memberId }: { memberId: string }) {
  const { t } = useTranslation("members")
  const { hasPermission } = useAuth()
  const canRead = hasPermission("members", "read")
  const canWrite = hasPermission("members", "update")
  const { data: notes = [] } = useMemberPastoralNotes(memberId, canRead)
  const create = useCreatePastoralNote(memberId)
  const [draft, setDraft] = useState("")

  if (!canRead) return null

  const save = async () => {
    try {
      await create.mutateAsync(draft.trim())
      setDraft("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pastoralNotes.saveError"))
    }
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5">
        <Lock className="text-muted-foreground size-3" />
        <div className="text-muted-foreground text-xs font-medium uppercase">{t("pastoralNotes.title")}</div>
      </div>
      <p className="text-muted-foreground mb-2 text-xs">{t("pastoralNotes.privacyHint")}</p>
      {canWrite && (
        <div className="mb-2 space-y-2">
          <Textarea
            aria-label={t("pastoralNotes.newNote")}
            placeholder={t("pastoralNotes.placeholder")}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={MAX_BODY}
            rows={3}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={save} disabled={!draft.trim() || create.isPending}>
              <Send className="size-3.5" />
              {create.isPending ? t("common:actions.saving") : t("common:actions.save")}
            </Button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {notes.map((n) => (
          <PastoralNoteItem key={n.id} note={n} memberId={memberId} />
        ))}
        {notes.length === 0 && <p className="text-muted-foreground text-sm">{t("pastoralNotes.empty")}</p>}
      </div>
    </div>
  )
}

function PastoralNoteItem({ note, memberId }: { note: PastoralNoteResponse; memberId: string }) {
  const { t } = useTranslation("members")
  const update = useUpdatePastoralNote(memberId)
  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(note.body)

  const startEdit = () => {
    setBody(note.body)
    setEditing(true)
  }

  const save = async () => {
    try {
      await update.mutateAsync({ id: note.id, body: body.trim() })
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pastoralNotes.saveError"))
    }
  }

  return (
    <div className="rounded-md border p-2 text-sm">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-xs">
          <span className="text-foreground font-medium">{note.author?.name ?? t("pastoralNotes.formerUser")}</span>
          <span>· {formatDateTime(note.createdAt)}</span>
          {note.updatedAt !== note.createdAt && <span>· {t("pastoralNotes.edited")}</span>}
          {note.source === "telegram" && <Badge variant="outline">{t("pastoralNotes.viaTelegram")}</Badge>}
        </div>
        {!editing && (
          <div className="flex items-center">
            {note.canEdit && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={startEdit}
                aria-label={t("pastoralNotes.editLabel")}
                title={t("common:actions.edit")}
              >
                <Pencil className="size-3.5" />
              </Button>
            )}
            {note.canDelete && <DeletePastoralNoteDialog note={note} memberId={memberId} />}
          </div>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            aria-label={t("pastoralNotes.editLabel")}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              {t("common:actions.cancel")}
            </Button>
            <Button size="sm" onClick={save} disabled={!body.trim() || update.isPending}>
              {update.isPending ? t("common:actions.saving") : t("common:actions.save")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap">{note.body}</div>
      )}
    </div>
  )
}

function DeletePastoralNoteDialog({ note, memberId }: { note: PastoralNoteResponse; memberId: string }) {
  const { t } = useTranslation("members")
  const remove = useDeletePastoralNote(memberId)
  const [open, setOpen] = useState(false)

  const confirm = async () => {
    try {
      await remove.mutateAsync(note.id)
      toast(t("pastoralNotes.delete.success"))
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pastoralNotes.delete.error"))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("pastoralNotes.delete.label")}
          title={t("common:actions.delete")}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("pastoralNotes.delete.title")}</DialogTitle>
          <DialogDescription>{t("pastoralNotes.delete.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">{t("common:actions.cancel")}</Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={remove.isPending}>
            {remove.isPending ? t("common:actions.deleting") : t("common:actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
