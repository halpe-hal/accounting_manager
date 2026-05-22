"use client";

import { useState, useEffect, useTransition } from "react";
import { addExpenseRows, saveExpenseRows, applyFixedExpenses } from "@/app/actions/expense";
import type { Expense, ExpenseCategory, DefaultPartner, AccountItem, FixedCategory } from "@/lib/types";

interface Props {
  expenses: Expense[];
  year: number;
  month: number;
  topCategory: string;
  expenseCategories: ExpenseCategory[];
  defaultPartners: DefaultPartner[];
  accountItems: AccountItem[];
  fixedCategories: FixedCategory[];
  onRefresh: () => void;
}

const PAYMENTS = ["現金", "クレジットカード", "銀行振込", "銀行引落", "その他"];

type EditableRow = {
  id: number | null;
  partner: string;
  account: string;
  detail: string;
  payment: string;
  cost: number;
  _delete: boolean;
};

function initRows(
  expenses: Expense[],
  selectedCategory: string,
  defaultPartners: DefaultPartner[],
  topCategory: string
): EditableRow[] {
  const filtered = expenses.filter((e) => e.second_category === selectedCategory);
  if (filtered.length > 0) {
    return filtered.map((e) => ({
      id: e.id,
      partner: e.partner,
      account: e.account,
      detail: e.detail ?? "",
      payment: e.payment,
      cost: e.cost ?? 0,
      _delete: false,
    }));
  }
  const defaults = defaultPartners.filter(
    (p) => p.second_category === selectedCategory && p.top_category === topCategory
  );
  return defaults.map((p) => ({
    id: null,
    partner: p.partner,
    account: p.account,
    detail: p.detail ?? "",
    payment: p.payment,
    cost: 0,
    _delete: false,
  }));
}

export default function ExpenseTable({
  expenses,
  year,
  month,
  topCategory,
  expenseCategories,
  defaultPartners,
  accountItems,
  fixedCategories,
  onRefresh,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState(expenseCategories[0]?.name ?? "");
  const [rows, setRows] = useState<EditableRow[]>(() =>
    initRows(expenses, expenseCategories[0]?.name ?? "", defaultPartners, topCategory)
  );
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [applyMessage, setApplyMessage] = useState("");
  const [isApplyError, setIsApplyError] = useState(false);
  const [isPendingReg, startRegTransition] = useTransition();
  const [isPendingUpd, startUpdTransition] = useTransition();
  const [isApplying, startApplyTransition] = useTransition();

  function showError(msg: string) { setMessage(msg); setIsError(true); }
  function showSuccess(msg: string) { setMessage(msg); setIsError(false); }

  useEffect(() => {
    setRows(initRows(expenses, selectedCategory, defaultPartners, topCategory));
    setMessage("");
  }, [year, month, topCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRows(initRows(expenses, selectedCategory, defaultPartners, topCategory));
    setMessage("");
  }, [selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRows(initRows(expenses, selectedCategory, defaultPartners, topCategory));
  }, [expenses]); // eslint-disable-line react-hooks/exhaustive-deps

  // from_fixed カラムがあればそれを優先、なければ fixed_categories との照合で判定
  const fixedApplied =
    expenses.some((e) => e.from_fixed === true) ||
    (fixedCategories.length > 0 &&
      fixedCategories.some((fc) =>
        expenses.some(
          (e) => e.partner === fc.partner && e.second_category === fc.second_category
        )
      ));

  const categoryTotals = expenseCategories
    .map((c) => ({
      name: c.name,
      is_fixed: c.is_fixed,
      total: expenses
        .filter((e) => e.second_category === c.name)
        .reduce((sum, e) => sum + (e.cost ?? 0), 0),
    }))
    .filter((c) => c.total > 0);
  const variableTotal = categoryTotals.filter((c) => !c.is_fixed).reduce((sum, c) => sum + c.total, 0);
  const fixedTotal = categoryTotals.filter((c) => c.is_fixed).reduce((sum, c) => sum + c.total, 0);
  const grandTotal = expenses.reduce((sum, e) => sum + (e.cost ?? 0), 0);

  function updateRow(idx: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: null, partner: "", account: accountItems[0]?.name ?? "", detail: "", payment: PAYMENTS[0], cost: 0, _delete: false },
    ]);
  }

  function handleRegister() {
    const newRows = rows.filter((r) => r.id === null && !r._delete && r.partner.trim());
    if (newRows.length === 0) {
      setMessage("登録対象がありません");
      return;
    }
    startRegTransition(async () => {
      const result = await addExpenseRows(year, month, topCategory, selectedCategory, newRows.map((r) => ({
        partner: r.partner,
        account: r.account,
        detail: r.detail,
        payment: r.payment,
        cost: Number(r.cost),
      })));
      if ("error" in result) { showError(result.error); return; }
      showSuccess(`${result.count}件を登録しました`);
      onRefresh();
    });
  }

  function handleUpdate() {
    const existingRows = rows.filter((r) => r.id !== null);
    const updates = existingRows.filter((r) => !r._delete).map((r) => ({
      id: r.id as number,
      partner: r.partner,
      account: r.account,
      detail: r.detail,
      payment: r.payment,
      cost: Number(r.cost),
    }));
    const deleteIds = existingRows.filter((r) => r._delete).map((r) => r.id as number);
    if (updates.length === 0 && deleteIds.length === 0) {
      setMessage("更新または削除対象がありませんでした");
      return;
    }
    startUpdTransition(async () => {
      const result = await saveExpenseRows(year, month, topCategory, selectedCategory, updates, deleteIds);
      if (result?.error) { showError(result.error); return; }
      showSuccess(`${updates.length}件更新、${deleteIds.length}件削除しました`);
      onRefresh();
    });
  }

  function handleApplyFixed() {
    setApplyMessage("");
    setIsApplyError(false);
    startApplyTransition(async () => {
      const result = await applyFixedExpenses(year, month, topCategory);
      if ("error" in result) { setApplyMessage(result.error); setIsApplyError(true); return; }
      setApplyMessage(`${result.count}件の固定費を反映しました`);
      onRefresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 出金集計 */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200" style={{ backgroundColor: "#c2302a" }}>
          <span className="text-sm font-bold text-white">出金集計</span>
        </div>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {categoryTotals.filter((c) => !c.is_fixed).length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan={2} className="py-1.5 px-4 text-xs font-semibold text-gray-500 border border-gray-200">変動費</td>
                </tr>
                {categoryTotals.filter((c) => !c.is_fixed).map((c) => (
                  <tr key={c.name}>
                    <td className="py-1.5 px-4 pl-8 text-black border border-gray-200">{c.name}</td>
                    <td className="py-1.5 px-4 text-right text-black border border-gray-200">¥{Math.round(c.total).toLocaleString("ja-JP")}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="py-1.5 px-4 text-black font-medium border border-gray-200">変動費小計</td>
                  <td className="py-1.5 px-4 text-right text-black font-medium border border-gray-200">¥{Math.round(variableTotal).toLocaleString("ja-JP")}</td>
                </tr>
              </>
            )}
            {categoryTotals.filter((c) => c.is_fixed).length > 0 && (
              <>
                <tr className="bg-gray-50">
                  <td colSpan={2} className="py-1.5 px-4 text-xs font-semibold text-gray-500 border border-gray-200">固定費</td>
                </tr>
                {categoryTotals.filter((c) => c.is_fixed).map((c) => (
                  <tr key={c.name}>
                    <td className="py-1.5 px-4 pl-8 text-black border border-gray-200">{c.name}</td>
                    <td className="py-1.5 px-4 text-right text-black border border-gray-200">¥{Math.round(c.total).toLocaleString("ja-JP")}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="py-1.5 px-4 text-black font-medium border border-gray-200">固定費小計</td>
                  <td className="py-1.5 px-4 text-right text-black font-medium border border-gray-200">¥{Math.round(fixedTotal).toLocaleString("ja-JP")}</td>
                </tr>
              </>
            )}
            <tr className="font-bold">
              <td className="py-2 px-4 text-black border border-gray-200">出金合計</td>
              <td className="py-2 px-4 text-right text-black border border-gray-200">¥{Math.round(grandTotal).toLocaleString("ja-JP")}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 出金明細 */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-gray-200 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-black">出金カテゴリを選択</span>
          </div>
          {fixedApplied ? (
            <span className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 bg-gray-50">
              固定費反映済み
            </span>
          ) : (
            <button
              onClick={handleApplyFixed}
              disabled={isApplying}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50"
            >
              {isApplying ? "反映中..." : "この月に固定費を反映する"}
            </button>
          )}
        </div>

        {applyMessage && (
          <div className={`px-4 py-2 text-sm border-b border-gray-200 ${isApplyError ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50"}`}>
            {applyMessage}
          </div>
        )}

        <div className="px-4 py-3 border-b border-gray-200">
          <label className="block text-xs text-black mb-1">費目カテゴリを選択</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>

        {selectedCategory && (
          <div className="px-4 py-2 border-b border-gray-200">
            <span className="text-sm font-semibold text-black">{selectedCategory}</span>
          </div>
        )}

        {message && (
          <div className={`px-4 py-2 text-sm border-b border-gray-200 ${isError ? "text-red-700 bg-red-50" : "text-green-700 bg-green-50"}`}>
            {message}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs text-black">
                <th className="py-2 px-3 text-left font-medium border border-gray-200">取引先</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">勘定項目</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">詳細</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">支払方法</th>
                <th className="py-2 px-3 text-right font-medium border border-gray-200">金額</th>
                <th className="py-2 px-3 text-center font-medium border border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-black text-sm border border-gray-200">
                    データがありません
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={idx} className={row._delete ? "opacity-40 bg-red-50" : "hover:bg-gray-50"}>
                    <td className="py-1 px-2 border border-gray-200">
                      <input
                        value={row.partner}
                        onChange={(e) => updateRow(idx, { partner: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <select
                        value={row.account}
                        onChange={(e) => updateRow(idx, { account: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white"
                      >
                        {accountItems.map((a) => (
                          <option key={a.id} value={a.name}>{a.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input
                        value={row.detail}
                        onChange={(e) => updateRow(idx, { detail: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <select
                        value={row.payment}
                        onChange={(e) => updateRow(idx, { payment: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white"
                      >
                        {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input
                        type="number"
                        value={row.cost}
                        onChange={(e) => updateRow(idx, { cost: Number(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200 text-center">
                      {row.id === null ? (
                        <button
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                          className="text-xs text-red-400 hover:text-red-600"
                        >×</button>
                      ) : (
                        <button
                          onClick={() => updateRow(idx, { _delete: !row._delete })}
                          className={`text-xs ${row._delete ? "text-gray-400" : "text-red-400 hover:text-red-600"}`}
                        >
                          {row._delete ? "取消" : "削除"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
          <button
            onClick={addRow}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-black hover:bg-gray-50"
          >
            ＋ 行を追加
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleRegister}
              disabled={isPendingReg}
              className="text-sm px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
              style={{ backgroundColor: "#006a38" }}
            >
              {isPendingReg ? "登録中..." : "登録"}
            </button>
            <button
              onClick={handleUpdate}
              disabled={isPendingUpd}
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-black hover:bg-gray-50 disabled:opacity-50"
            >
              {isPendingUpd ? "更新中..." : "更新"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
