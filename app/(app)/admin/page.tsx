import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/permissions";
import { getAdminUsers, getUserPagePermissions } from "@/app/actions/admin";
import PagePermissionsClient from "@/components/admin/PagePermissionsClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/");
  }

  const [users, permissionsMap] = await Promise.all([
    getAdminUsers(),
    getUserPagePermissions(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">ページ権限管理</h1>
      <p className="text-sm text-gray-500 mb-6">
        ユーザーごとにアクセスできるページを設定します。管理者は全ページへのアクセスが自動的に許可されます。
      </p>
      <PagePermissionsClient users={users} permissionsMap={permissionsMap} />
    </div>
  );
}
