"use client";

import { useState, useEffect, useTransition } from "react";
import { addSaleRows, saveSaleRows } from "@/app/actions/sales";
import type { Sale, IncomeSource } from "@/lib/types";

interface Props {
  sales: Sale[];
  year: number;
  month: number;
  topCategory: string;
  incomeSources: IncomeSource[];
  onRefresh: () => void;
}

const TAX_RATES = ["売上10%", "売上8%", "その他売上10%", "その他売上8%"];
const PAYMENTS = ["現金", "銀行振込", "クレジット", "paygent", "paypal", "その他"];

type EditableRow = {
  id: number | null;
  partner: string;
  detail: string;
  expected_amount: number;
  received_amount: number;
  payment: string;
  invoice_issued: boolean;
  tax_rate: string;
  _delete: boolean;
};

function initRows(sales: Sale[], incomeSources: IncomeSource[]): EditableRow[] {
  if (sales.length > 0) {
    return sales.map((s) => ({
      id: s.id,
      partner: s.partner,
      detail: s.detail ?? "",
      expected_amount: s.expected_amount ?? 0,
      received_amount: s.received_amount ?? 0,
      payment: s.payment ?? PAYMENTS[0],
      invoice_issued: s.invoice_issued ?? false,
      tax_rate: s.tax_rate ?? TAX_RATES[0],
      _delete: false,
    }));
  }
  return incomeSources.map((s) => ({
    id: null,
    partner: s.partner,
    detail: s.detail ?? "",
    expected_amount: s.expected_amount ?? 0,
    received_amount: s.received_amount ?? 0,
    payment: s.payment || PAYMENTS[0],
    invoice_issued: false,
    tax_rate: s.tax_rate || TAX_RATES[0],
    _delete: false,
  }));
}

export default function SalesTable({
  sales,
  year,
  month,
  topCategory,
  incomeSources,
  onRefresh,
}: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() => initRows(sales, incomeSources));
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isPendingReg, startRegTransition] = useTransition();
  const [isPendingUpd, startUpdTransition] = useTransition();

  function showError(msg: string) { setMessage(msg); setIsError(true); }
  function showSuccess(msg: string) { setMessage(msg); setIsError(false); }

  useEffect(() => {
    setRows(initRows(sales, incomeSources));
    setMessage("");
  }, [year, month, topCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setRows(initRows(sales, incomeSources));
  }, [sales]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalByTaxRate = TAX_RATES.reduce<Record<string, number>>((acc, r) => {
    acc[r] = sales.filter((s) => s.tax_rate === r).reduce((sum, s) => sum + (s.received_amount ?? 0), 0);
    return acc;
  }, {});
  const grandTotal = sales.reduce((sum, s) => sum + (s.received_amount ?? 0), 0);

  function updateRow(idx: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: null, partner: "", detail: "", expected_amount: 0, received_amount: 0, payment: PAYMENTS[0], invoice_issued: false, tax_rate: TAX_RATES[0], _delete: false },
    ]);
  }

  function handleRegister() {
    const newRows = rows.filter((r) => r.id === null && !r._delete && r.partner.trim());
    if (newRows.length === 0) {
      setMessage("登録対象がありません");
      return;
    }
    startRegTransition(async () => {
      const result = await addSaleRows(year, month, topCategory, newRows.map((r) => ({
        partner: r.partner,
        detail: r.detail,
        expected_amount: Number(r.expected_amount),
        received_amount: Number(r.received_amount),
        payment: r.payment,
        invoice_issued: r.invoice_issued,
        tax_rate: r.tax_rate,
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
      detail: r.detail,
      expected_amount: Number(r.expected_amount),
      received_amount: Number(r.received_amount),
      payment: r.payment,
      invoice_issued: r.invoice_issued,
      tax_rate: r.tax_rate,
    }));
    const deleteIds = existingRows.filter((r) => r._delete).map((r) => r.id as number);
    if (updates.length === 0 && deleteIds.length === 0) {
      setMessage("更新または削除対象がありませんでした");
      return;
    }
    startUpdTransition(async () => {
      const result = await saveSaleRows(year, month, topCategory, updates, deleteIds);
      if (result?.error) { showError(result.error); return; }
      showSuccess(`${updates.length}件更新、${deleteIds.length}件削除しました`);
      onRefresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 入金集計 */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200" style={{ backgroundColor: "#00a497" }}>
          <span className="text-sm font-bold text-white">入金集計</span>
        </div>
        <table className="w-full text-sm border-collapse">
          <tbody>
            {TAX_RATES.map((r) => (
              <tr key={r}>
                <td className="py-2 px-4 text-black border border-gray-200">{r}</td>
                <td className="py-2 px-4 text-right text-black border border-gray-200">
                  ¥{Math.round(totalByTaxRate[r] ?? 0).toLocaleString("ja-JP")}
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className="py-2 px-4 text-black border border-gray-200">入金合計</td>
              <td className="py-2 px-4 text-right text-black border border-gray-200">
                ¥{Math.round(grandTotal).toLocaleString("ja-JP")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 入金明細 */}
      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200">
          <span className="text-sm font-semibold text-black">入金明細</span>
        </div>

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
                <th className="py-2 px-3 text-left font-medium border border-gray-200">詳細</th>
                <th className="py-2 px-3 text-right font-medium border border-gray-200">入金予定額</th>
                <th className="py-2 px-3 text-right font-medium border border-gray-200">入金済み額</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">入金方法</th>
                <th className="py-2 px-3 text-center font-medium border border-gray-200">請求書</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">税区分</th>
                <th className="py-2 px-3 text-center font-medium border border-gray-200">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-black text-sm border border-gray-200">
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
                      <input
                        value={row.detail}
                        onChange={(e) => updateRow(idx, { detail: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm"
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input
                        type="number"
                        value={row.expected_amount}
                        onChange={(e) => updateRow(idx, { expected_amount: Number(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-right"
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input
                        type="number"
                        value={row.received_amount}
                        onChange={(e) => updateRow(idx, { received_amount: Number(e.target.value) })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-right"
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
                    <td className="py-1 px-2 border border-gray-200 text-center">
                      <input
                        type="checkbox"
                        checked={row.invoice_issued}
                        onChange={(e) => updateRow(idx, { invoice_issued: e.target.checked })}
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <select
                        value={row.tax_rate}
                        onChange={(e) => updateRow(idx, { tax_rate: e.target.value })}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white"
                      >
                        {TAX_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
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
