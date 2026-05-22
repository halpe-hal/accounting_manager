"use client";

import { useState, useTransition } from "react";
import {
  grantDivisionAccess,
  revokeDivisionAccess,
  grantAllDivisionAccess,
  revokeAllDivisionAccess,
  type AdminUser,
} from "@/app/actions/admin";
import type { Division } from "@/lib/types";
import { divisionDisplayName } from "@/lib/division-utils";

interface Props {
  users: AdminUser[];
  accessMap: Record<string, string[]>;
  divisions: Division[];
}

export default function DivisionAccessClient({ users, accessMap, divisions }: Props) {
  const [localMap, setLocalMap] = useState<Record<string, string[]>>(accessMap);
  const [, startTransition] = useTransition();

  const isGranted = (userId: string, divisionName: string) =>
    (localMap[userId] ?? []).includes(divisionName);

  const [permError, setPermError] = useState<string | null>(null);

  const toggle = (user: AdminUser, divisionName: string) => {
    if (user.is_admin) return;
    const granted = isGranted(user.user_id, divisionName);
    setLocalMap((prev) => {
      const current = prev[user.user_id] ?? [];
      return {
        ...prev,
        [user.user_id]: granted
          ? current.filter((d) => d !== divisionName)
          : [...current, divisionName],
      };
    });
    startTransition(async () => {
      const result = granted
        ? await revokeDivisionAccess(user.user_id, divisionName)
        : await grantDivisionAccess(user.user_id, divisionName);
      if (result?.error) setPermError(result.error);
    });
  };

  const grantAll = (user: AdminUser) => {
    if (user.is_admin) return;
    const allNames = divisions.map((d) => d.name);
    setLocalMap((prev) => ({ ...prev, [user.user_id]: allNames }));
    startTransition(async () => {
      const result = await grantAllDivisionAccess(user.user_id, allNames);
      if (result?.error) setPermError(result.error);
    });
  };

  const revokeAll = (user: AdminUser) => {
    if (user.is_admin) return;
    setLocalMap((prev) => ({ ...prev, [user.user_id]: [] }));
    startTransition(async () => {
      const result = await revokeAllDivisionAccess(user.user_id);
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
              {divisions.map((d) => (
                <th
                  key={d.id}
                  className="text-center py-3 px-3 font-medium text-gray-600 whitespace-nowrap"
                >
                  {divisionDisplayName(d)}
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
                {divisions.map((d) => (
                  <td key={d.id} className="py-3 px-3 text-center">
                    {user.is_admin ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <button
                        onClick={() => toggle(user, d.name)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                          isGranted(user.user_id, d.name) ? "bg-green-600" : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                            isGranted(user.user_id, d.name) ? "translate-x-5" : "translate-x-1"
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
