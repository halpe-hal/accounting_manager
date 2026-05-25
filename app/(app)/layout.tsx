import { redirect } from "next/navigation";
import { getPermissions, can, ADMIN_EMAILS, PAGE_PERMISSIONS } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { isDepreciationMode } from "@/lib/depreciation-mode";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const perms = await getPermissions();
  const isAdmin = ADMIN_EMAILS.includes(user.email ?? "");

  if (!isAdmin && !PAGE_PERMISSIONS.some((p) => can(perms, p.key))) {
    redirect("/auth/signout");
  }

  const depreciationMode = isAdmin ? await isDepreciationMode() : false;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isAdmin={isAdmin} perms={perms} depreciationMode={depreciationMode} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
