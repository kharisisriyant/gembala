import { Routes, Route } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { AuthProvider, RequireAuth, RequirePermission, RequireSystemAdmin } from "@/lib/auth"
import { Layout } from "@/components/layout"
import { DashboardPage } from "@/pages/dashboard"
import { LandingPage } from "@/pages/landing"
import { SmallGroupsPage } from "@/pages/small-groups"
import { GroupDetailPage } from "@/pages/group-detail"
import { MembersPage } from "@/pages/members"
import { TagsPage } from "@/pages/tags"
import { RoomsPage } from "@/pages/rooms"
import { EventsPage } from "@/pages/events"
import { InvitesPage } from "@/pages/invites"
import { RolesPage } from "@/pages/roles"
import { TeamPage } from "@/pages/team"
import { TelegramPage } from "@/pages/telegram"
import { LoginPage } from "@/pages/auth/login"
import { RegisterPage } from "@/pages/auth/register"
import { ForgotPasswordPage } from "@/pages/auth/forgot-password"
import { ResetPasswordPage } from "@/pages/auth/reset-password"
import { AcceptInvitePage } from "@/pages/auth/accept-invite"

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/groups" element={<SmallGroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/members" element={<MembersPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route
            path="/settings/invites"
            element={
              <RequirePermission resource="invites" action="read">
                <InvitesPage />
              </RequirePermission>
            }
          />
          <Route
            path="/settings/team"
            element={
              <RequireSystemAdmin>
                <TeamPage />
              </RequireSystemAdmin>
            }
          />
          <Route
            path="/settings/roles"
            element={
              <RequireSystemAdmin>
                <RolesPage />
              </RequireSystemAdmin>
            }
          />
          <Route path="/settings/telegram" element={<TelegramPage />} />
        </Route>
      </Routes>
      <Toaster richColors position="top-right" />
    </AuthProvider>
  )
}
