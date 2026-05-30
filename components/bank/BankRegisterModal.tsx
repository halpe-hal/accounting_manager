"use client";

import { useState, useEffect, useCallback } from "react";
import { getRegistrationFormData, findExistingExpense } from "@/app/actions/credit-card-register";
import { registerExpenseFromBank } from "@/app/actions/expense";
import type { BankRecord } from "./parseBankCsv";
import type { RegistrationFormData } from "@/app/actions/credit-card-register";
import type { Expense, FixedCategory, DefaultPartner } from "@/lib/types";

interface Props {
  record: BankRecord;
  onClose: () => void;
  onSuccess: (key: string) => void;
}

export default function BankRegisterModal({ record, onClose, onSuccess }: Props) {
  const [year, setYear] = useState(record.year);
  const [month, setMonth] = useState(record.month);
  const [topCategory, setTopCategory] = useState("");
  const [secondCategory, setSecondCategory] = useState("");
  const [partner, setPartner] = useState(record.description);
  const [account, setAccount] = useState("");
  const [detail, setDetail] = useState("");
  const [updateMode, setUpdateMode] = useState<"add" | "replace" | null>(null);
  const [selectedFixed, setSelectedFixed] = useState<FixedCategory | null>(null);
  const [useDefaultPartner, setUseDefaultPartner] = useState(false);
  const [selectedDefaultPartner, setSelectedDefaultPartner] = useState<DefaultPartner | null>(null);

  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [existingExpense, setExistingExpense] = useState<Expense | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRegistrationFormData().then((d) => { setFormData(d); setLoading(false); });
  }, []);

  const checkExisting = useCallback(() => {
    if (!topCategory || !secondCategory || !partner) { setExistingExpense(undefined); return; }
    setChecking(true);
    findExistingExpense(year, month, topCategory, secondCategory, partner).then((exp) => {
      setExistingExpense(exp);
      setChecking(false);
      if (!exp) setUpdateMode(null);
    });
  }, [year, month, topCategory, secondCategory, partner]);

  useEffect(() => { checkExisting(); }, [checkExisting]);

  const FIXED_CATEGORY_NAME = "その他固定費";
  const isFixedMode = secondCategory === FIXED_CATEGORY_NAME;
  const fixedOptions = formData
    ? (formData.fixedCategories ?? []).filter((f) => f.top_category === topCategory && f.second_category === FIXED_CATEGORY_NAME)
    : [];

  function handleSelectFixed(fc: FixedCategory | null) {
    setSelectedFixed(fc);
    if (fc) { setPartner(fc.partner); setAccount(fc.account); setDetail(fc.detail); }
  }

  function handleSelectDefaultPartner(dp: DefaultPartner | null) {
    setSelectedDefaultPartner(dp);
    if (dp) {
      setPartner(dp.partner);
      setAccount(dp.account);
      setDetail(dp.detail);
    } else {
      setPartner(record.description);
      setAccount("");
      setDetail("");
    }
  }

  function handleToggleDefaultPartner(checked: boolean) {
    setUseDefaultPartner(checked);
    if (!checked) handleSelectDefaultPartner(null);
  }

  const defaultPartnerOptions = (formData?.defaultPartners ?? []).filter(
    (dp) => dp.top_category === topCategory && dp.second_category === secondCategory
  );

  const isLocked = (isFixedMode && !!selectedFixed) || !!selectedDefaultPartner;
  const canSubmit = !!topCategory && !!secondCategory && !submitting &&
    (!isFixedMode || !!selectedFixed || !!selectedDefaultPartner) &&
    (!useDefaultPartner || !!selectedDefaultPartner);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await registerExpenseFromBank({
      year, month, topCategory, secondCategory, partner, account, detail,
      cost: record.amount,
      existingId: updateMode && existingExpense ? existingExpense.id : undefined,
      existingCost: updateMode === "add" && existingExpense ? existingExpense.cost : 0,
    });
    if ("error" in result) { setError(result.error); setSubmitting(false); return; }
    onSuccess(`${record.date}__${record.description}__${record.amount}__${record.type}__${record.bank}`);
  }

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
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800">出金明細へ登録</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* 明細サマリー */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-700 truncate">{record.description}</span>
              <span className="font-semibold text-red-700 whitespace-nowrap">▼ ¥{record.amount.toLocaleString("ja-JP")}</span>
            </div>
            <div className="text-xs text-gray-400 mt-0.5">{record.date} · {record.bank}</div>
          </div>

          {/* 年・月 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">年</label>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">月</label>
              <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
          </div>

          {/* 事業部 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">事業部 <span className="text-red-500">*</span></label>
            <select value={topCategory} onChange={(e) => { setTopCategory(e.target.value); setUseDefaultPartner(false); handleSelectDefaultPartner(null); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">選択してください</option>
              {formData.divisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          {/* 費目 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">費目 <span className="text-red-500">*</span></label>
            <select value={secondCategory} onChange={(e) => { setSecondCategory(e.target.value); handleSelectFixed(null); setUseDefaultPartner(false); handleSelectDefaultPartner(null); }}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">選択してください</option>
              {formData.categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          {/* 固定費セレクター */}
          {isFixedMode && !selectedDefaultPartner && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">固定費を選択 <span className="text-red-500">*</span></label>
              {!topCategory ? (
                <p className="text-xs text-gray-400">先に事業部を選択してください</p>
              ) : fixedOptions.length === 0 ? (
                <p className="text-xs text-gray-400">この事業部の固定費がありません</p>
              ) : (
                <select value={selectedFixed?.id ?? ""} onChange={(e) => handleSelectFixed(fixedOptions.find((f) => f.id === Number(e.target.value)) ?? null)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                  <option value="">選択してください</option>
                  {fixedOptions.map((f) => <option key={f.id} value={f.id}>{f.partner}{f.detail ? `（${f.detail}）` : ""}</option>)}
                </select>
              )}
            </div>
          )}

          {/* 取引先デフォルト設定から選択 */}
          {topCategory && secondCategory && defaultPartnerOptions.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useDefaultPartner}
                  onChange={(e) => handleToggleDefaultPartner(e.target.checked)}
                  className="rounded border-gray-300"
                />
                取引先デフォルト設定から選択
              </label>
              {useDefaultPartner && (
                <select
                  value={selectedDefaultPartner?.id ?? ""}
                  onChange={(e) => {
                    const dp = defaultPartnerOptions.find((d) => d.id === Number(e.target.value)) ?? null;
                    handleSelectDefaultPartner(dp);
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-gray-400"
                >
                  <option value="">選択してください</option>
                  {defaultPartnerOptions.map((dp) => (
                    <option key={dp.id} value={dp.id}>{dp.partner}{dp.detail ? `（${dp.detail}）` : ""}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* 取引先 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">取引先</label>
            <input type="text" value={partner} onChange={(e) => setPartner(e.target.value)}
              readOnly={isLocked}
              className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none ${isLocked ? "bg-gray-50 text-gray-500" : ""}`} />
          </div>

          {/* 科目 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">科目</label>
            <select value={account} onChange={(e) => setAccount(e.target.value)}
              disabled={isLocked}
              className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none ${isLocked ? "text-gray-500" : ""}`}>
              <option value="">-</option>
              {formData.accounts.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">備考</label>
            <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)}
              readOnly={isLocked} placeholder="任意"
              className={`w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none ${isLocked ? "bg-gray-50 text-gray-500" : ""}`} />
          </div>

          {/* 既存チェック */}
          {checking && <p className="text-xs text-gray-400">既存の登録を確認中...</p>}
          {!checking && existingExpense && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-sm text-blue-800">この費目に「{existingExpense.partner}」の登録が既にあります（¥{existingExpense.cost.toLocaleString("ja-JP")}）。</p>
              <div className="space-y-1.5">
                {([
                  { value: null, label: "新規行として追加する" },
                  { value: "add", label: `金額を追加して更新（¥${existingExpense.cost.toLocaleString("ja-JP")} + ¥${record.amount.toLocaleString("ja-JP")} = ¥${(existingExpense.cost + record.amount).toLocaleString("ja-JP")}）` },
                  { value: "replace", label: `金額を差し替えて更新（¥${existingExpense.cost.toLocaleString("ja-JP")} → ¥${record.amount.toLocaleString("ja-JP")}）` },
                ] as const).map((opt) => (
                  <label key={String(opt.value)} className="flex items-center gap-2 text-sm text-blue-800 cursor-pointer">
                    <input type="radio" name="updateMode" checked={updateMode === opt.value}
                      onChange={() => setUpdateMode(opt.value as "add" | "replace" | null)} className="border-blue-300" />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400">支払方法: 銀行引落（固定）</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <span className="text-sm font-bold text-gray-800">¥{record.amount.toLocaleString("ja-JP")}</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">キャンセル</button>
            <button onClick={handleSubmit} disabled={!canSubmit}
              className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-40"
              style={{ backgroundColor: "#006a38" }}>
              {submitting ? "登録中..." : "登録"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
