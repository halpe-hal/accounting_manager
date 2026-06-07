"use client";

import { useState, useTransition } from "react";
import { addRemunerationChange, deleteRemunerationChange } from "@/app/actions/social-insurance";
import type { SocialInsuranceEmployee, SocialInsuranceRemunerationChange } from "@/lib/types";

interface Props {
  employee: SocialInsuranceEmployee;
  changes: SocialInsuranceRemunerationChange[];
  onClose: () => void;
  onAdded: (change: SocialInsuranceRemunerationChange) => void;
  onDeleted: (id: number) => void;
}

function formatYen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const now = new Date();
const YEARS = Array.from({ length: 30 }, (_, i) => now.getFullYear() - i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function RemunerationChangeModal({ employee, changes, onClose, onAdded, onDeleted }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [remuneration, setRemuneration] = useState(employee.standard_monthly_remuneration);

  const sorted = [...changes].sort((a, b) => (a.change_year - b.change_year) || (a.change_month - b.change_month));

  function handleAdd() {
    setError("");
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) { setError("変更月を選択してください"); return; }
    if (changes.some((c) => c.change_year === y && c.change_month === m)) {
      setError("同じ月の変更が既に登録されています");
      return;
    }
    startTransition(async () => {
      const result = await addRemunerationChange(employee.id, y, m, remuneration);
      if ("error" in result) { setError(result.error); return; }
      onAdded({ id: result.id, employee_id: employee.id, change_year: y, change_month: m, standard_monthly_remuneration: remuneration });
    });
  }

  function handleDelete(id: number) {
    if (!confirm("この変更履歴を削除しますか？")) return;
    setError("");
    startTransition(async () => {
      const result = await deleteRemunerationChange(id);
      if (result?.error) { setError(result.error); return; }
      onDeleted(id);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">月額変更（随時改定）</h2>
          <p className="text-sm text-gray-500 mt-0.5">{employee.name} さんの変更月と変更後の標準報酬月額を登録します</p>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">変更月</label>
              <div className="flex gap-1">
                <select
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
                >
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-500 mb-1">変更後の標準報酬月額</label>
              <input
                type="number"
                value={remuneration}
                onChange={(e) => setRemuneration(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={isPending}
              className="text-xs px-4 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: "#006a38" }}
            >
              {isPending ? "登録中..." : "登録"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-2">変更履歴</p>
            {sorted.length === 0 ? (
              <p className="text-sm text-gray-400">登録されている変更はありません</p>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500">
                    <th className="py-2 px-3 text-left font-medium border-b border-gray-200">変更月</th>
                    <th className="py-2 px-3 text-right font-medium border-b border-gray-200">変更後の標準報酬月額</th>
                    <th className="py-2 px-3 text-center font-medium border-b border-gray-200">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <tr key={c.id} className="border-b border-gray-100">
                      <td className="py-2 px-3 text-gray-700">{c.change_year}年{c.change_month}月〜</td>
                      <td className="py-2 px-3 text-right text-gray-800">{formatYen(c.standard_monthly_remuneration)}</td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={isPending}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          削除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
