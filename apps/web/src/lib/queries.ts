import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ChangePasswordInput,
  MeResponse,
  UpdateProfileInput,
  AttendanceHeatmapResponse,
  DashboardResponse,
  EventCreateInput,
  EventResponse,
  EventUpdateInput,
  GroupCreateInput,
  GroupDetailResponse,
  GroupSummaryResponse,
  GroupUpdateInput,
  InstanceTypeCreateInput,
  InstanceTypeResponse,
  InstanceTypeUpdateInput,
  InviteCreateInput,
  InviteResponse,
  MemberCreateInput,
  MemberDetailResponse,
  MemberImportInput,
  MemberImportResult,
  MemberResponse,
  MemberUpdateInput,
  RoleAssignmentCreateInput,
  RoleAssignmentResponse,
  RoleCreateInput,
  RoleResponse,
  RoleTemplateCreateInput,
  RoleTemplateResponse,
  RoleTemplateUpdateInput,
  RoleUpdateInput,
  RoomCreateInput,
  RoomResponse,
  RoomUpdateInput,
  ScheduleEventCreateInput,
  ScheduleEventDetailResponse,
  ScheduleEventUpdateInput,
  ServiceInstanceCreateInput,
  ServiceInstanceResponse,
  SessionCreateInput,
  SessionResponse,
  TagCreateInput,
  TagResponse,
  TagUpdateInput,
  TeamMemberResponse,
  TelegramLinkStatusResponse,
} from "@gembala/shared"
import { apiFetch } from "./api"

// --- reads -----------------------------------------------------------------

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch<DashboardResponse>("/dashboard"),
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ["members"],
    queryFn: () => apiFetch<MemberResponse[]>("/members"),
  })
}

export function useMember(id: string | null) {
  return useQuery({
    queryKey: ["members", id],
    queryFn: () => apiFetch<MemberDetailResponse>(`/members/${id}`),
    enabled: Boolean(id),
  })
}

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: () => apiFetch<GroupSummaryResponse[]>("/groups"),
  })
}

export function useAttendanceHeatmap() {
  return useQuery({
    queryKey: ["groups", "attendance-heatmap"],
    queryFn: () => apiFetch<AttendanceHeatmapResponse>("/groups/attendance-heatmap"),
  })
}

export function useGroup(id: string | undefined) {
  return useQuery({
    queryKey: ["groups", id],
    queryFn: () => apiFetch<GroupDetailResponse>(`/groups/${id}`),
    enabled: Boolean(id),
    retry: (failureCount, error) =>
      failureCount < 2 && !(error instanceof Error && "status" in error),
  })
}

export function useTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: () => apiFetch<TagResponse[]>("/tags"),
  })
}

export function useRooms() {
  return useQuery({
    queryKey: ["rooms"],
    queryFn: () => apiFetch<RoomResponse[]>("/rooms"),
  })
}

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: () => apiFetch<EventResponse[]>("/events"),
  })
}

export function useInstanceTypes() {
  return useQuery({
    queryKey: ["instance-types"],
    queryFn: () => apiFetch<InstanceTypeResponse[]>("/scheduling/instance-types"),
  })
}

export function useRoleTemplates() {
  return useQuery({
    queryKey: ["role-templates"],
    queryFn: () => apiFetch<RoleTemplateResponse[]>("/scheduling/role-templates"),
  })
}

export function useScheduleEvents() {
  return useQuery({
    queryKey: ["schedule-events"],
    queryFn: () => apiFetch<ScheduleEventDetailResponse[]>("/scheduling/events"),
  })
}

export function useInvites() {
  return useQuery({
    queryKey: ["invites"],
    queryFn: () => apiFetch<InviteResponse[]>("/invites"),
  })
}

export function useTelegramLink() {
  return useQuery({
    queryKey: ["telegram-link"],
    queryFn: () => apiFetch<TelegramLinkStatusResponse>("/telegram/link"),
  })
}

// --- writes ----------------------------------------------------------------

export function useCreateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MemberCreateInput) =>
      apiFetch<MemberResponse>("/members", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
      void qc.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}

export function useImportMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: MemberImportInput) =>
      apiFetch<MemberImportResult>("/members/import", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["members"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
      void qc.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}

export function useUpdateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: MemberUpdateInput & { id: string }) =>
      apiFetch<MemberResponse>(`/members/${id}`, { method: "PATCH", body: input }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["members"] })
      void qc.invalidateQueries({ queryKey: ["members", id] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
      void qc.invalidateQueries({ queryKey: ["tags"] })
    },
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GroupCreateInput) =>
      apiFetch<GroupSummaryResponse>("/groups", { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["groups"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useUpdateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: GroupUpdateInput & { id: string }) =>
      apiFetch<GroupSummaryResponse>(`/groups/${id}`, { method: "PATCH", body: input }),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: ["groups"] })
      void qc.invalidateQueries({ queryKey: ["groups", id] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useLogAttendance(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SessionCreateInput) =>
      apiFetch<SessionResponse>(`/groups/${groupId}/sessions`, { method: "POST", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["groups"] })
      void qc.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoomCreateInput) =>
      apiFetch<RoomResponse>("/rooms", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["rooms"] }),
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: RoomUpdateInput & { id: string }) =>
      apiFetch<RoomResponse>(`/rooms/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rooms"] })
      void qc.invalidateQueries({ queryKey: ["events"] })
    },
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/rooms/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rooms"] })
      void qc.invalidateQueries({ queryKey: ["events"] })
    },
  })
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: EventCreateInput) =>
      apiFetch<EventResponse>("/events", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["events"] }),
  })
}

export function useUpdateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: EventUpdateInput & { id: string }) =>
      apiFetch<EventResponse>(`/events/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["events"] }),
  })
}

export function useDeleteEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/events/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["events"] }),
  })
}

export function useCreateInstanceType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InstanceTypeCreateInput) =>
      apiFetch<InstanceTypeResponse>("/scheduling/instance-types", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["instance-types"] }),
  })
}

export function useUpdateInstanceType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: InstanceTypeUpdateInput & { id: string }) =>
      apiFetch<InstanceTypeResponse>(`/scheduling/instance-types/${id}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["instance-types"] })
      void qc.invalidateQueries({ queryKey: ["schedule-events"] })
    },
  })
}

export function useDeleteInstanceType() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/scheduling/instance-types/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["instance-types"] })
      void qc.invalidateQueries({ queryKey: ["schedule-events"] })
    },
  })
}

export function useCreateRoleTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoleTemplateCreateInput) =>
      apiFetch<RoleTemplateResponse>("/scheduling/role-templates", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["role-templates"] }),
  })
}

export function useUpdateRoleTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: RoleTemplateUpdateInput & { id: string }) =>
      apiFetch<RoleTemplateResponse>(`/scheduling/role-templates/${id}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["role-templates"] })
      void qc.invalidateQueries({ queryKey: ["schedule-events"] })
    },
  })
}

export function useDeleteRoleTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/scheduling/role-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["role-templates"] })
      void qc.invalidateQueries({ queryKey: ["schedule-events"] })
    },
  })
}

export function useCreateScheduleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ScheduleEventCreateInput) =>
      apiFetch<ScheduleEventDetailResponse>("/scheduling/events", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useUpdateScheduleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: ScheduleEventUpdateInput & { id: string }) =>
      apiFetch<ScheduleEventDetailResponse>(`/scheduling/events/${id}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useDeleteScheduleEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/scheduling/events/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useCreateServiceInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ eventId, ...input }: ServiceInstanceCreateInput & { eventId: string }) =>
      apiFetch<ServiceInstanceResponse>(`/scheduling/events/${eventId}/instances`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useDeleteServiceInstance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (instanceId: string) =>
      apiFetch<void>(`/scheduling/instances/${instanceId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useCreateRoleAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ instanceId, ...input }: RoleAssignmentCreateInput & { instanceId: string }) =>
      apiFetch<RoleAssignmentResponse>(`/scheduling/instances/${instanceId}/assignments`, {
        method: "POST",
        body: input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useUpdateRoleAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ assignmentId, ...input }: RoleAssignmentCreateInput & { assignmentId: string }) =>
      apiFetch<RoleAssignmentResponse>(`/scheduling/assignments/${assignmentId}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useDeleteRoleAssignment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assignmentId: string) =>
      apiFetch<void>(`/scheduling/assignments/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["schedule-events"] }),
  })
}

export function useCreateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TagCreateInput) =>
      apiFetch<TagResponse>("/tags", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tags"] }),
  })
}

export function useUpdateTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, ...input }: TagUpdateInput & { name: string }) =>
      apiFetch<void>(`/tags/${name}`, { method: "PATCH", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tags"] }),
  })
}

export function useDeleteTag() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => apiFetch<void>(`/tags/${name}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tags"] })
      void qc.invalidateQueries({ queryKey: ["members"] })
    },
  })
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => apiFetch<RoleResponse[]>("/roles"),
  })
}

export function useCreateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoleCreateInput) =>
      apiFetch<RoleResponse>("/roles", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useUpdateRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: RoleUpdateInput & { id: string }) =>
      apiFetch<RoleResponse>(`/roles/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useDeleteRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["roles"] }),
  })
}

export function useTeam() {
  return useQuery({
    queryKey: ["team"],
    queryFn: () => apiFetch<TeamMemberResponse[]>("/team"),
  })
}

export function useUpdateMembershipRoles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ membershipId, roleIds }: { membershipId: string; roleIds: string[] }) =>
      apiFetch<void>(`/team/${membershipId}/roles`, { method: "PUT", body: { roleIds } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["team"] }),
  })
}

export function useAssignableRoles() {
  return useQuery({
    queryKey: ["roles", "assignable"],
    queryFn: () => apiFetch<RoleResponse[]>("/roles/assignable"),
  })
}

export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: InviteCreateInput) =>
      apiFetch<InviteResponse>("/invites", { method: "POST", body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["invites"] }),
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["invites"] }),
  })
}

export function useUnlinkTelegram() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>("/telegram/link", { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["telegram-link"] }),
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProfileInput) =>
      apiFetch<MeResponse>("/auth/profile", { method: "PATCH", body: input }),
    onSuccess: (me) => qc.setQueryData(["me"], me),
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      apiFetch<void>("/auth/change-password", { method: "POST", body: input }),
  })
}
