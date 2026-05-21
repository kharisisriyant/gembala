import Link from "next/link";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/rbac";

export default async function SettingsPage() {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) redirect("/dashboard");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Settings</h1>
      <div className="grid gap-3">
        {[
          { href: "/settings/tags", title: "Tags", desc: "Manage member tags and categories" },
          { href: "/settings/users", title: "Users", desc: "Manage leaders and their tag access" },
          { href: "/settings/integrations", title: "Integrations", desc: "Telegram bot connection" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-300 transition-colors"
          >
            <p className="font-medium text-gray-900">{item.title}</p>
            <p className="text-sm text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
