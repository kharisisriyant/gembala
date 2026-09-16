import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AttendanceHeatmapResponse,
  DashboardResponse,
  GroupCreateInput,
  GroupDetailResponse,
  GroupSummaryResponse,
  GroupUpdateInput,
  InviteCreateInput,
  InviteResponse,
  MemberCreateInput,
  MemberDetailResponse,
  MemberResponse,
  SessionCreateInput,
  SessionResponse,
  TagCreateInput,
  TagResponse,
  TagUpdateInput,
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
