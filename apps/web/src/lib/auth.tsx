import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { Navigate, useLocation } from "react-router-dom"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  AcceptInviteInput,
  AuthResponse,
  LoginInput,
  MeResponse,
  PermissionAction,
  PermissionResource,
  RegisterInput,
} from "@gembala/shared"
import { permissionKey } from "@gembala/shared"
import { apiFetch, authenticate, clearToken, getToken, logoutRequest, restoreSession, setToken } from "./api"

type AuthContextValue = {
  me: MeResponse | null
  isLoading: boolean
  isSystemAdmin: boolean
  permissions: Set<string>
  hasPermission: (resource: PermissionResource, action: PermissionAction) => boolean
  login: (input: LoginInput) => Promise<void>
  register: (input: RegisterInput) => Promise<void>
  acceptInvite: (input: AcceptInviteInput) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [hasToken, setHasToken] = useState(() => Boolean(getToken()))
  const [isRestoring, setIsRestoring] = useState(true)

  useEffect(() => {
    void restoreSession().then((session) => {
      if (session) {
        setHasToken(true)
        queryClient.setQueryData(["me"], session.me)
      }
    }).finally(() => setIsRestoring(false))
  }, [queryClient])

  const { data: me = null, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/auth/me"),
    enabled: hasToken,
    staleTime: 60_000,
    retry: false,
  })

  const applyAuth = useCallback(
    (res: AuthResponse) => {
      setToken(res.accessToken)
      setHasToken(true)
      queryClient.setQueryData(["me"], res.me)
      // fresh identity = fresh scope: drop everything cached
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "me" })
    },
    [queryClient],
  )

  const login = useCallback(
    async (input: LoginInput) => {
      applyAuth(await authenticate("/auth/login", input))
    },
    [applyAuth],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      applyAuth(await authenticate("/auth/register", input))
    },
    [applyAuth],
  )

  const acceptInvite = useCallback(
    async (input: AcceptInviteInput) => {
      applyAuth(await authenticate("/auth/accept-invite", input))
    },
    [applyAuth],
  )

  const logout = useCallback(() => {
    void logoutRequest().catch(() => undefined)
    clearToken()
    setHasToken(false)
    queryClient.clear()
  }, [queryClient])

  const permissions = useMemo(() => new Set(me?.permissions ?? []), [me])
  const isSystemAdmin = me?.isSystemAdmin ?? false
  const hasPermission = useCallback(
    (resource: PermissionResource, action: PermissionAction) =>
      isSystemAdmin || permissions.has(permissionKey(resource, action)),
    [isSystemAdmin, permissions],
  )

  return (
    <AuthContext.Provider
      value={{
        me,
        isLoading: isRestoring || (hasToken && isLoading),
        isSystemAdmin,
        permissions,
        hasPermission,
        login,
        register,
        acceptInvite,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { me, isLoading } = useAuth()
  const location = useLocation()

  if (!getToken() && !isLoading) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-dvh items-center justify-center text-sm">
        Loading…
      </div>
    )
  }
  if (!me) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

function Forbidden() {
  return (
    <div className="text-muted-foreground flex h-64 items-center justify-center text-sm">
      You don't have access to this page.
    </div>
  )
}

export function RequirePermission({
  resource,
  action,
  children,
}: {
  resource: PermissionResource
  action: PermissionAction
  children: React.ReactNode
}) {
  const { hasPermission } = useAuth()
  return hasPermission(resource, action) ? <>{children}</> : <Forbidden />
}

export function RequireSystemAdmin({ children }: { children: React.ReactNode }) {
  const { isSystemAdmin } = useAuth()
  return isSystemAdmin ? <>{children}</> : <Forbidden />
}
