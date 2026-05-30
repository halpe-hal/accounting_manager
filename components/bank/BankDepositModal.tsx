"use client";

import { useState, useEffect } from "react";
import { getRegistrationFormData } from "@/app/actions/credit-card-register";
import { registerIncomeFromBank } from "@/app/actions/bank-register";
import type { BankRecord } from "./parseBankCsv";
import type { RegistrationFormData } from "@/app/actions/credit-card-register";

interface Props {
  record: BankRecord;
  onClose: () => void;
  onSuccess: (keys: string[]) => void;
}

const TAX_RATES = ["10%", "8%", "0%", "非課税"];

export default function BankDepositModal({ record, onClose, onSuccess }: Props) {
  const [year, setYear] = useState(record.year);
  const [month, setMonth] = useState(record.month);
  const [topCategory, setTopCategory] = useState("");
  const [partner, setPartner] = useState(record.description);
  const [detail, setDetail] = useState("");
  const [taxRate, setTaxRate] = useState("10%");

  const [formData, setFormData] = useState<RegistrationFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRegistrationFormData().then((d) => { setFormData(d); setLoading(false); });
  }, []);

  const canSubmit = !!topCategory && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await registerIncomeFromBank({ year, month, topCategory, partner, detail, amount: record.amount, taxRate });
    if ("error" in result) { setError(result.error); setSubmitting(false); return; }
    onSuccess([`bidx:${record._idx}`]);
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
          <h2 className="text-base font-semibold text-gray-800">入金明細へ登録</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* 明細サマリー */}
          <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
            <div className="flex justify-between items-start gap-2">
              <span className="text-gray-700 truncate">{record.description}</span>
              <span className="font-semibold text-green-700 whitespace-nowrap">▲ ¥{record.amount.toLocaleString("ja-JP")}</span>
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
            <select value={topCategory} onChange={(e) => setTopCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
              <option value="">選択してください</option>
              {formData.divisions.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>

          {/* 取引先 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">取引先</label>
            <input type="text" value={partner} onChange={(e) => setPartner(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">備考</label>
            <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="任意"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
          </div>

          {/* 税率 */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">税率</label>
            <select value={taxRate} onChange={(e) => setTaxRate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
              {TAX_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <p className="text-xs text-gray-400">支払方法: 銀行振込（固定）</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <span className="text-sm font-bold text-green-700">¥{record.amount.toLocaleString("ja-JP")}</span>
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
