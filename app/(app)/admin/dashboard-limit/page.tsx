import { getAdminUsers, getDashboardRowLimits } from "@/app/actions/admin";
import DashboardRowLimitClient from "@/components/admin/DashboardRowLimitClient";

export default async function DashboardLimitPage() {
  const [users, limitsMap] = await Promise.all([
    getAdminUsers(),
    getDashboardRowLimits(),
  ]);
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">ダッシュボード表示制限</h1>
      <p className="text-sm text-gray-500 mb-4">
        各ユーザーがダッシュボードで表示できる最終行を設定します。選択した行より下は非表示になります。
      </p>
      <DashboardRowLimitClient users={users} limitsMap={limitsMap} />
    </div>
  );
}
