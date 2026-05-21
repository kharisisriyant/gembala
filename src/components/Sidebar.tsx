"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import type { UserRole } from "@/lib/auth";

interface Props {
  user: {
    name?: string | null;
    email?: string | null;
    role: UserRole;
    churchId: string;
  };
}

const nav = [
  { href: "/dashboard", label: "Dashboard", roles: ["super_admin", "admin", "zone_leader", "cell_leader"] },
  { href: "/members", label: "Members", roles: ["super_admin", "admin", "zone_leader", "cell_leader"] },
  { href: "/groups", label: "Small Groups", roles: ["super_admin", "admin", "zone_leader", "cell_leader"] },
  { href: "/analytics", label: "Analytics", roles: ["super_admin", "admin", "zone_leader"] },
  { href: "/settings", label: "Settings", roles: ["super_admin", "admin"] },
] as const;

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-lg font-bold text-indigo-700">Gembala</h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {nav
          .filter((item) => item.roles.includes(user.role as any))
          .map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="p-3 border-t border-gray-200">
        <p className="text-xs text-gray-500 truncate">{user.name}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="mt-2 text-xs text-red-500 hover:underline"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
