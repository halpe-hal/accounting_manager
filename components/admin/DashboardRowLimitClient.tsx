"use client";

import { useState, useTransition } from "react";
import { setDashboardRowLimit, type AdminUser } from "@/app/actions/admin";
import { PL_ROWS } from "@/lib/dashboard-rows";

interface Props {
  users: AdminUser[];
  limitsMap: Record<string, string>;
}

export default function DashboardRowLimitClient({ users, limitsMap }: Props) {
  const [localMap, setLocalMap] = useState<Record<string, string>>(limitsMap);
  const [permError, setPermError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handleChange = (user: AdminUser, value: string) => {
    if (user.is_admin) return;
    setLocalMap((prev) => ({ ...prev, [user.user_id]: value }));
    startTransition(async () => {
      const result = await setDashboardRowLimit(user.user_id, value || null);
      if (result?.error) setPermError(result.error);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      {permError && (
        <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">
          {permError}
          <button onClick={() => setPermError(null)} className="text-red-400">×</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 pr-6 font-medium text-gray-600 whitespace-nowrap min-w-[220px]">
                ユーザー
              </th>
              <th className="text-left py-3 px-3 font-medium text-gray-600 whitespace-nowrap">
                表示上限行
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-6">
                  <div className="font-medium text-gray-800 text-xs truncate max-w-[220px]">
                    {user.email}
                  </div>
                  {user.is_admin && (
                    <span className="text-xs text-white px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#006a38" }}>
                      管理者
                    </span>
                  )}
                </td>
                <td className="py-3 px-3">
                  {user.is_admin ? (
                    <span className="text-xs text-gray-400">制限なし（管理者）</span>
                  ) : (
                    <select
                      value={localMap[user.user_id] ?? ""}
                      onChange={(e) => handleChange(user, e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white focus:outline-none min-w-[220px]"
                    >
                      <option value="">制限なし（全て表示）</option>
                      {PL_ROWS.map((row) => (
                        <option key={row} value={row}>{row}まで</option>
                      ))}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            ユーザーが見つかりません。
          </p>
        )}
      </div>
    </div>
  );
}
