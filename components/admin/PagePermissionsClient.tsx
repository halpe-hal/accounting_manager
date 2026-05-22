"use client";

import { useState, useTransition } from "react";
import {
  grantPagePermission,
  revokePagePermission,
  grantAllPagePermissions,
  revokeAllPagePermissions,
  type AdminUser,
} from "@/app/actions/admin";
import { PAGE_PERMISSIONS } from "@/lib/page-permissions";

interface Props {
  users: AdminUser[];
  permissionsMap: Record<string, string[]>;
}

export default function PagePermissionsClient({ users, permissionsMap }: Props) {
  const [localMap, setLocalMap] = useState<Record<string, string[]>>(permissionsMap);
  const [, startTransition] = useTransition();

  const isGranted = (userId: string, appName: string) =>
    (localMap[userId] ?? []).includes(appName);

  const [permError, setPermError] = useState<string | null>(null);

  const toggle = (user: AdminUser, appName: string) => {
    if (user.is_admin) return;
    const granted = isGranted(user.user_id, appName);
    setLocalMap((prev) => {
      const current = prev[user.user_id] ?? [];
      return {
        ...prev,
        [user.user_id]: granted
          ? current.filter((a) => a !== appName)
          : [...current, appName],
      };
    });
    startTransition(async () => {
      const result = granted
        ? await revokePagePermission(user.user_id, appName)
        : await grantPagePermission(user.user_id, appName);
      if (result?.error) setPermError(result.error);
    });
  };

  const grantAll = (user: AdminUser) => {
    if (user.is_admin) return;
    const allKeys = PAGE_PERMISSIONS.map((p) => p.key as string);
    setLocalMap((prev) => ({ ...prev, [user.user_id]: allKeys }));
    startTransition(async () => {
      const result = await grantAllPagePermissions(user.user_id, allKeys);
      if (result?.error) setPermError(result.error);
    });
  };

  const revokeAll = (user: AdminUser) => {
    if (user.is_admin) return;
    setLocalMap((prev) => ({ ...prev, [user.user_id]: [] }));
    startTransition(async () => {
      const result = await revokeAllPagePermissions(user.user_id);
      if (result?.error) setPermError(result.error);
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      {permError && <div className="mb-4 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">{permError}<button onClick={() => setPermError(null)} className="text-red-400">×</button></div>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-3 pr-6 font-medium text-gray-600 whitespace-nowrap min-w-[180px]">
                ユーザー
              </th>
              {PAGE_PERMISSIONS.map((p) => (
                <th
                  key={p.key}
                  className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap"
                >
                  {p.label}
                </th>
              ))}
              <th className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap">
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.user_id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-3 pr-6">
                  <div className="font-medium text-gray-800 text-xs truncate max-w-[180px]">
                    {user.email}
                  </div>
                  {user.is_admin && (
                    <span className="text-xs text-white px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#006a38" }}>
                      管理者
                    </span>
                  )}
                </td>
                {PAGE_PERMISSIONS.map((p) => (
                  <td key={p.key} className="py-3 px-3 text-center">
                    {user.is_admin ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <button
                        onClick={() => toggle(user, p.key)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          isGranted(user.user_id, p.key) ? "bg-green-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            isGranted(user.user_id, p.key) ? "translate-x-5" : "translate-x-1"
                          }`}
                        />
                      </button>
                    )}
                  </td>
                ))}
                <td className="py-3 px-3 text-center">
                  {!user.is_admin && (
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => grantAll(user)}
                        className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                      >
                        全付与
                      </button>
                      <button
                        onClick={() => revokeAll(user)}
                        className="px-2 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                      >
                        全解除
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">
            ユーザーが見つかりません。ログインしたユーザーがここに表示されます。
          </p>
        )}
      </div>
    </div>
  );
}
