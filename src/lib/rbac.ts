import type { UserRole } from "@/lib/auth";

export function isAdmin(role: UserRole) {
  return role === "admin" || role === "super_admin";
}

export function isLeaderOrAbove(role: UserRole) {
  return ["super_admin", "admin", "zone_leader", "cell_leader"].includes(role);
}

export function canManageTags(role: UserRole) {
  return isAdmin(role);
}

export function canGrantTagAccess(role: UserRole) {
  return isAdmin(role);
}

export function canManageMembers(role: UserRole) {
  return isLeaderOrAbove(role);
}

export function canExportData(role: UserRole) {
  return isAdmin(role);
}
