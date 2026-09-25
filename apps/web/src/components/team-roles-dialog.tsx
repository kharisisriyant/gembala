import { useState } from "react"
import { toast } from "sonner"
import type { TeamMemberResponse } from "@gembala/shared"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useRoles, useUpdateMembershipRoles } from "@/lib/queries"

export function TeamRolesDialog({
  member,
  open,
  onOpenChange,
}: {
  member: TeamMemberResponse
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const { data: roles = [] } = useRoles()
  const updateRoles = useUpdateMembershipRoles()
  const [picked, setPicked] = useState<Set<string>>(new Set(member.roles.map((r) => r.id)))

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const save = async () => {
    try {
      await updateRoles.mutateAsync({ membershipId: member.membershipId, roleIds: [...picked] })
      toast.success(`${member.user.name}'s roles updated`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update roles")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit {member.user.name}'s roles</DialogTitle>
          <DialogDescription>{member.user.email}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          {roles.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
              <span className="text-sm">{r.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={save} disabled={updateRoles.isPending}>
            {updateRoles.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
