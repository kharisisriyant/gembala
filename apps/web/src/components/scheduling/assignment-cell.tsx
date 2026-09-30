import { useId, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil } from "lucide-react"
import { Popover } from "radix-ui"
import { toast } from "sonner"
import type { RoleAssignmentResponse } from "@gembala/shared"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useCreateRoleAssignment, useMembers } from "@/lib/queries"
import { AssignmentDialog } from "./assignment-dialog"

export function assignmentHighlightKey(assignment: RoleAssignmentResponse) {
  return assignment.member
    ? `member:${assignment.member.id}`
    : `text:${assignment.freeText.trim().replace(/\s+/g, " ").toLocaleLowerCase()}`
}

type AssignmentCellProps = {
  instanceId: string
  roleTemplateId: string
  roleName: string
  instanceName: string
  assignments: RoleAssignmentResponse[]
  canManage: boolean
  highlightedKey: string | null
  onHighlight: (key: string) => void
}

function AssignmentInput({ instanceId, roleTemplateId, roleName, instanceName, assignments }: AssignmentCellProps) {
  const { t } = useTranslation("scheduling")
  const { data: members = [], isLoading, isError } = useMembers()
  const createAssignment = useCreateRoleAssignment()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
  const listId = useId()
  const text = query.trim()
  const matches = members.filter((member) => member.name.toLocaleLowerCase().includes(text.toLocaleLowerCase()))
  const options = [...matches.map((member) => ({ memberId: member.id, label: member.name })), { memberId: null, label: text }]
  const expanded = open && Boolean(text)

  const add = async (memberId: string | null) => {
    if (!text || savingRef.current) return
    savingRef.current = true
    try {
      await createAssignment.mutateAsync({
        instanceId,
        roleTemplateId,
        memberId,
        freeText: memberId ? "" : text,
        sortOrder: Math.max(-1, ...assignments.map((assignment) => assignment.sortOrder)) + 1,
      })
      setQuery("")
      setOpen(false)
      setActiveIndex(-1)
      toast.success(t("toast.assignmentSaved"))
      inputRef.current?.focus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.assignmentError"))
    } finally {
      savingRef.current = false
    }
  }

  const option = (index: number) => (
    <button
      key={options[index].memberId ?? "free-text"}
      id={`${listId}-${index}`}
      type="button"
      role="option"
      aria-selected={activeIndex === index}
      disabled={createAssignment.isPending}
      tabIndex={-1}
      className="hover:bg-accent aria-selected:bg-accent block w-full rounded-sm px-2 py-2 text-left text-sm whitespace-normal disabled:opacity-50"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => void add(options[index].memberId)}
    >
      {options[index].memberId ? options[index].label : t("assignment.useText", { text })}
    </button>
  )

  return (
    <Popover.Root open={expanded} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <Input
          ref={inputRef}
          role="combobox"
          aria-label={t("assignment.inputLabel", { role: roleName, instance: instanceName })}
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={expanded && activeIndex >= 0 && activeIndex < options.length ? `${listId}-${activeIndex}` : undefined}
          placeholder={t("assignment.placeholder")}
          value={query}
          maxLength={200}
          readOnly={createAssignment.isPending}
          className="h-8 min-w-40 flex-1 border-transparent bg-transparent shadow-none hover:border-input"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            setActiveIndex(-1)
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault()
              setOpen(true)
              const next = event.key === "ArrowDown"
                ? (activeIndex + 1) % options.length
                : (activeIndex <= 0 ? options.length : activeIndex) - 1
              setActiveIndex(next)
              document.getElementById(`${listId}-${next}`)?.scrollIntoView({ block: "nearest" })
            } else if (event.key === "Enter" && expanded && activeIndex >= 0 && activeIndex < options.length) {
              event.preventDefault()
              void add(options[activeIndex].memberId)
            } else if (event.key === "Escape" || event.key === "Tab") {
              setOpen(false)
            }
          }}
        />
      </Popover.Anchor>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="bg-popover text-popover-foreground z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border p-1 shadow-md"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => { if (event.target === inputRef.current) event.preventDefault() }}
        >
          <div id={listId} role="listbox" aria-label={t("assignment.suggestions")} aria-busy={createAssignment.isPending}>
            <div role="group" aria-labelledby={`${listId}-members`}>
              <div id={`${listId}-members`} className="text-muted-foreground px-2 py-1.5 text-xs font-medium">{t("assignment.members")}</div>
              <div className="max-h-48 overflow-y-auto">
                {matches.map((_, index) => option(index))}
                {(isLoading || isError || matches.length === 0) && (
                  <p className="text-muted-foreground px-2 py-2 text-sm">{t(isLoading ? "assignment.loading" : isError ? "assignment.searchError" : "assignment.noMembers")}</p>
                )}
              </div>
            </div>
            <div role="group" aria-labelledby={`${listId}-text`} className="mt-1 border-t pt-1">
              <div id={`${listId}-text`} className="text-muted-foreground px-2 py-1.5 text-xs font-medium">{t("assignment.freeText")}</div>
              {option(matches.length)}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

export function AssignmentCell(props: AssignmentCellProps) {
  const { instanceId, roleTemplateId, roleName, instanceName, assignments, canManage, highlightedKey, onHighlight } = props
  const { t } = useTranslation("scheduling")
  const [editing, setEditing] = useState<RoleAssignmentResponse | null>(null)

  return (
    <div className="flex min-w-44 flex-wrap items-center gap-1">
      {assignments.length === 0 && !canManage && <span className="text-muted-foreground">{t("assignment.empty")}</span>}
      {assignments.map((assignment) => {
        const key = assignmentHighlightKey(assignment)
        const highlighted = highlightedKey === key
        const label = assignment.member?.name ?? assignment.freeText
        return (
          <Badge key={assignment.id} variant={highlighted ? "default" : "muted"} className={highlighted ? "ring-primary/40 ring-2" : undefined}>
            <button type="button" className="cursor-pointer rounded-sm focus-visible:outline-2" aria-pressed={highlighted} aria-label={t("assignment.highlight", { name: label })} onClick={() => onHighlight(key)}>{label}</button>
            {canManage && (
              <button type="button" className="hover:bg-foreground/10 cursor-pointer rounded-sm p-1 focus-visible:outline-2" aria-label={t("assignment.edit", { name: label })} onClick={() => setEditing(assignment)}>
                <Pencil className="size-3" />
              </button>
            )}
          </Badge>
        )
      })}
      {canManage && <AssignmentInput {...props} />}
      {editing && (
        <AssignmentDialog
          open
          onOpenChange={(value) => !value && setEditing(null)}
          instanceId={instanceId}
          roleTemplateId={roleTemplateId}
          roleName={roleName}
          instanceName={instanceName}
          assignment={editing}
          sortOrder={editing.sortOrder}
        />
      )}
    </div>
  )
}
