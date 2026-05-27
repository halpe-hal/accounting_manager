"use client";

import { useState, useTransition } from "react";
import { reflectSocialInsurance } from "@/app/actions/expense";

export type DivisionItem = {
  division: string;
  employer: number;
  employee: number;
};

interface Props {
  year: number;
  month: number;
  divisions: DivisionItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function formatYen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

const EMPLOYER_META = {
  secondCategory: "人件費",
  partner: "日本年金機構",
  account: "法定福利費",
  detail: "社会保険料（事業主負担）",
  payment: "銀行引落",
} as const;

const EMPLOYEE_META = {
  secondCategory: "源泉税・地方税・社会保険料",
  partner: "日本年金機構",
  account: "預り金",
  detail: "社会保険料（従業員負担）",
  payment: "銀行引落",
} as const;

export default function ReflectModal({ year, month, divisions, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const totalEmployer = divisions.reduce((s, d) => s + d.employer, 0);
  const totalEmployee = divisions.reduce((s, d) => s + d.employee, 0);

  function handleConfirm() {
    const items = divisions.flatMap((d) => [
      { topCategory: d.division, ...EMPLOYER_META, cost: d.employer },
      { topCategory: d.division, ...EMPLOYEE_META, cost: d.employee },
    ]);
    startTransition(async () => {
      const result = await reflectSocialInsurance(year, month, items);
      if ("error" in result) { setError(result.error); return; }
      onSuccess();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">出金明細への反映確認</h2>
          <p className="text-sm text-gray-500 mt-0.5">{year}年{month}月分を以下の内容で登録します</p>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* 登録内容の説明 */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-blue-50 rounded-xl px-4 py-3 space-y-1">
              <p className="font-semibold text-blue-700 mb-1">事業主負担</p>
              <p className="text-gray-600">費目：{EMPLOYER_META.secondCategory}</p>
              <p className="text-gray-600">取引先：{EMPLOYER_META.partner}</p>
              <p className="text-gray-600">科目：{EMPLOYER_META.account}</p>
              <p className="text-gray-600">詳細：{EMPLOYER_META.detail}</p>
              <p className="text-gray-600">支払：{EMPLOYER_META.payment}</p>
            </div>
            <div className="bg-green-50 rounded-xl px-4 py-3 space-y-1">
              <p className="font-semibold text-green-700 mb-1">従業員負担</p>
              <p className="text-gray-600">費目：{EMPLOYEE_META.secondCategory}</p>
              <p className="text-gray-600">取引先：{EMPLOYEE_META.partner}</p>
              <p className="text-gray-600">科目：{EMPLOYEE_META.account}</p>
              <p className="text-gray-600">詳細：{EMPLOYEE_META.detail}</p>
              <p className="text-gray-600">支払：{EMPLOYEE_META.payment}</p>
            </div>
          </div>

          {/* 事業部別金額 */}
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="py-2 px-3 text-left font-medium border-b border-gray-200">事業部</th>
                <th className="py-2 px-3 text-right font-medium border-b border-gray-200 text-blue-600">事業主負担</th>
                <th className="py-2 px-3 text-right font-medium border-b border-gray-200 text-green-600">従業員負担</th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((d) => (
                <tr key={d.division} className="border-b border-gray-100">
                  <td className="py-2 px-3 text-gray-700">{d.division}</td>
                  <td className="py-2 px-3 text-right text-gray-800">{formatYen(d.employer)}</td>
                  <td className="py-2 px-3 text-right text-gray-800">{formatYen(d.employee)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="py-2 px-3 text-gray-700 text-xs">合計</td>
                <td className="py-2 px-3 text-right text-blue-700">{formatYen(totalEmployer)}</td>
                <td className="py-2 px-3 text-right text-green-700">{formatYen(totalEmployee)}</td>
              </tr>
            </tfoot>
          </table>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending}
            className="text-sm px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ backgroundColor: "#006a38" }}
          >
            {isPending ? "反映中..." : "反映する"}
          </button>
        </div>
      </div>
    </div>
  );
}
