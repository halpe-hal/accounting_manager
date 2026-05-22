import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/permissions";
import { getAdminUsers, getUserDivisionAccess } from "@/app/actions/admin";
import { getDivisionsForSettings } from "@/app/actions/settings";
import DivisionAccessClient from "@/components/admin/DivisionAccessClient";

export default async function AdminDivisionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    redirect("/");
  }

  const [users, accessMap, divisions] = await Promise.all([
    getAdminUsers(),
    getUserDivisionAccess(),
    getDivisionsForSettings(),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">事業部アクセス管理</h1>
      <p className="text-sm text-gray-500 mb-6">
        ユーザーごとに閲覧できる事業部・店舗を設定します。管理者は全事業部へのアクセスが自動的に許可されます。
      </p>
      <DivisionAccessClient users={users} accessMap={accessMap} divisions={divisions} />
    </div>
  );
}
