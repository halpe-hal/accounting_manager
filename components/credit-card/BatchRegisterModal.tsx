"use client";

import { useState, useEffect, useCallback } from "react";
import { getRegistrationFormData, findExistingExpense } from "@/app/actions/credit-card-register";
import { registerExpenseFromCard } from "@/app/actions/expense";
import { recordKey } from "./RegisterModal";
import type { CardRecord } from "./parseCardCsv";
import type { RegistrationFormData } from "@/app/actions/credit-card-register";
import type { Expense } from "@/lib/types";

interface Props {
  selectedRecords: CardRecord[];
  onClose: () => void;
  onSuccess: (keys: string[]) => void;
}

export default function BatchRegisterModal({ selectedRecords, onClose, onSuccess }: Props) {
  const totalAmount = selectedRecords.reduce((s, r) => s + r.amount, 0);

  const [partner, setPartner] = useState("");
  const [year, setYear] = useState(selectedRecords[0]?.year ?? new Date().getFullYear());
  const [month, setMonth] = useState(selectedRecords[0]?.month ?? new Date().getMonth() + 1);
  const [topCategory, setTopCategory] = useState("");
  const [secondCategory, setSecondCategory] = useState("");
  const [account, setAccount] = useState("");
  const [detail, setDetail] = useState("");
  const [updateExisting, setUpdateExisting] = useState(false);

  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [existingExpense, setExistingExpense] = useState<Expense | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRegistrationFormData().then((data) => {
      setFormData(data);
      setLoading(false);
    });
  }, []);

  const checkExisting = useCallback(() => {
    if (!topCategory || !secondCategory || !partner) {
      setExistingExpense(undefined);
      return;
    }
    setChecking(true);
    findExistingExpense(year, month, topCategory, secondCategory, partner).then((exp) => {
      setExistingExpense(exp);
      setChecking(false);
      if (!exp) setUpdateExisting(false);
    });
  }, [year, month, topCategory, secondCategory, partner]);

  useEffect(() => {
    checkExisting();
  }, [checkExisting]);

  const canSubmit = !!partner.trim() && !!topCategory && !!secondCategory && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const result = await registerExpenseFromCard({
      year, month, topCategory, secondCategory,
      partner: partner.trim(), account, detail,
      cost: totalAmount,
      existingId: updateExisting && existingExpense ? existingExpense.id : undefined,
      existingCost: updateExisting && existingExpense ? existingExpense.cost : undefined,
    });

    if ("error" in result) {
      setError(result.error);
      setSubmitting(false);
      return;
    }

    onSuccess(selectedRecords.map(recordKey));
  }

  const yearOptions = [...new Set(selectedRecords.map((r) => r.year))].sort();

  if (loading || !formData) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl px-6 py-4 text-sm text-gray-500">読込中...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">
            {selectedRecords.length}件をまとめて登録
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* 選択明細リスト */}
          <div className="bg-gray-50 rounded-xl overflow-hidden max-h-44 overflow-y-auto">
            {selectedRecords.map((r, i) => (
              <div
                key={i}
                className="flex justify-between px-3 py-1.5 text-sm border-b border-gray-100 last:border-0"
              >
                <div className="min-w-0">
                  <span className="text-gray-600 truncate block">{r.description}</span>
                  <span className="text-xs text-gray-400">{r.date}</span>
                </div>
                <span className="text-gray-800 whitespace-nowrap ml-3 self-center">
                  ¥{r.amount.toLocaleString("ja-JP")}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm font-semibold text-gray-800 px-1">
            <span>合計 {selectedRecords.length}件</span>
            <span>¥{totalAmount.toLocaleString("ja-JP")}</span>
          </div>

          {/* 支払先名（カスタム） */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              支払先名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="例: 3月分諸経費"
              autoFocus
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* 年・月 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">年</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">月</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}月</option>
                ))}
              </select>
            </div>
          </div>

          {/* 事業部 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              事業部 <span className="text-red-500">*</span>
            </label>
            <select
              value={topCategory}
              onChange={(e) => setTopCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            >
              <option value="">選択してください</option>
              {formData.divisions.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* 費目 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              費目 <span className="text-red-500">*</span>
            </label>
            <select
              value={secondCategory}
              onChange={(e) => setSecondCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            >
              <option value="">選択してください</option>
              {formData.categories.map((c) => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* 科目 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">科目</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            >
              <option value="">-</option>
              {formData.accounts.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">備考</label>
            <input
              type="text"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="任意"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-gray-400"
            />
          </div>

          {/* 既存明細チェック */}
          {checking && <p className="text-xs text-gray-400">既存の登録を確認中...</p>}
          {!checking && existingExpense && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm text-blue-800">
                この費目に「{existingExpense.partner}」の登録が既にあります（¥{existingExpense.cost.toLocaleString("ja-JP")}）。
              </p>
              <label className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded"
                />
                金額を追加して更新（¥{existingExpense.cost.toLocaleString("ja-JP")} + ¥{totalAmount.toLocaleString("ja-JP")} = ¥{(existingExpense.cost + totalAmount).toLocaleString("ja-JP")}）
              </label>
            </div>
          )}

          <p className="text-xs text-gray-400">支払方法: クレジットカード（固定）</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="text-sm">
            <span className="text-gray-500">登録金額: </span>
            <span className="font-bold text-gray-800">¥{totalAmount.toLocaleString("ja-JP")}</span>
            {updateExisting && existingExpense && (
              <span className="text-xs text-gray-500 ml-1">
                → 合計 ¥{(existingExpense.cost + totalAmount).toLocaleString("ja-JP")}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 text-sm text-white rounded-lg transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "#006a38" }}
            >
              {submitting ? "登録中..." : "登録"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
