"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addIncomeSource, updateIncomeSource, deleteIncomeSource } from "@/app/actions/settings";
import type { IncomeSource, Division } from "@/lib/types";
import { sortDivisionsByBrand, divisionDisplayName } from "@/lib/division-utils";

const TAX_RATES = ["売上10%", "売上8%", "その他売上10%", "その他売上8%"];
const PAYMENTS = ["選択してください", "現金", "銀行振込", "クレジット", "paygent", "paypal", "その他"];

interface Props {
  initial: IncomeSource[];
  divisions: Division[];
}

export default function IncomeSourcesTab({ initial, divisions }: Props) {
  const router = useRouter();
  const sortedDivs = sortDivisionsByBrand(divisions);
  const [items, setItems] = useState(initial);
  useEffect(() => { setItems(initial); }, [initial]);
  const [activeDiv, setActiveDiv] = useState(sortedDivs[0]?.name ?? "");
  const [editingId, setEditingId] = useState<number | null>(null);

  const [newPartner, setNewPartner] = useState("");
  const [newDetail, setNewDetail] = useState("");
  const [newExpected, setNewExpected] = useState(0);
  const [newReceived, setNewReceived] = useState(0);
  const [newPayment, setNewPayment] = useState(PAYMENTS[0]);
  const [newTaxRate, setNewTaxRate] = useState(TAX_RATES[0]);

  const [editPartner, setEditPartner] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editExpected, setEditExpected] = useState(0);
  const [editReceived, setEditReceived] = useState(0);
  const [editPayment, setEditPayment] = useState("");
  const [editTaxRate, setEditTaxRate] = useState("");

  const [isPending, startTransition] = useTransition();
  const [permError, setPermError] = useState<string | null>(null);

  const filtered = items.filter((i) => i.top_category === activeDiv);

  async function handleAdd() {
    if (!newPartner.trim()) return;
    startTransition(async () => {
      const result = await addIncomeSource({
        partner: newPartner.trim(),
        topCategory: activeDiv,
        taxRate: newTaxRate,
        detail: newDetail,
        expectedAmount: newExpected,
        receivedAmount: newReceived,
        payment: newPayment === "選択してください" ? "" : newPayment,
      });
      if (result?.error) { setPermError(result.error); return; }
      setNewPartner(""); setNewDetail(""); setNewExpected(0); setNewReceived(0);
      setNewPayment(PAYMENTS[0]); setNewTaxRate(TAX_RATES[0]);
      router.refresh();
    });
  }

  function startEdit(row: IncomeSource) {
    setEditingId(row.id);
    setEditPartner(row.partner);
    setEditDetail(row.detail ?? "");
    setEditExpected(row.expected_amount ?? 0);
    setEditReceived(row.received_amount ?? 0);
    setEditPayment(row.payment ?? "");
    setEditTaxRate(row.tax_rate ?? TAX_RATES[0]);
  }

  async function handleUpdate(id: number) {
    const result = await updateIncomeSource(id, {
      partner: editPartner,
      detail: editDetail,
      expected_amount: editExpected,
      received_amount: editReceived,
      payment: editPayment,
      tax_rate: editTaxRate,
    });
    if (result?.error) { setPermError(result.error); return; }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("削除しますか？")) return;
    const result = await deleteIncomeSource(id);
    if (result?.error) { setPermError(result.error); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-black mb-4">入金元デフォルト設定</h2>
      {permError && <div className="mb-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">{permError}<button onClick={() => setPermError(null)} className="text-red-400">×</button></div>}

      {/* 事業部タブ */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {sortedDivs.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDiv(d.name)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeDiv === d.name
                ? "text-white"
                : "bg-white border border-gray-200 text-black hover:bg-gray-50"
            }`}
            style={activeDiv === d.name ? { backgroundColor: "#006a38" } : {}}
          >
            {divisionDisplayName(d)}
          </button>
        ))}
      </div>

      {/* 追加フォーム */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-xs font-semibold text-black mb-2">{activeDiv} の入金元を新規登録</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs text-black mb-0.5">入金元</label>
            <input
              value={newPartner}
              onChange={(e) => setNewPartner(e.target.value)}
              placeholder="例：Uber"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">詳細（任意）</label>
            <input
              value={newDetail}
              onChange={(e) => setNewDetail(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">入金予定額</label>
            <input
              type="number"
              value={newExpected}
              onChange={(e) => setNewExpected(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">入金済額</label>
            <input
              type="number"
              value={newReceived}
              onChange={(e) => setNewReceived(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">入金手段</label>
            <select
              value={newPayment}
              onChange={(e) => setNewPayment(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            >
              {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">税率</label>
            <select
              value={newTaxRate}
              onChange={(e) => setNewTaxRate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            >
              {TAX_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={isPending || !newPartner.trim()}
            className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#006a38" }}
          >
            登録
          </button>
        </div>
      </div>

      {/* 一覧 */}
      <h3 className="text-xs font-semibold text-black mb-2">登録済み入金元</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-xs text-black">
            <th className="py-2 px-3 text-left font-medium border border-gray-200">入金元</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">詳細</th>
            <th className="py-2 px-3 text-right font-medium border border-gray-200">予定額</th>
            <th className="py-2 px-3 text-right font-medium border border-gray-200">済額</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">入金手段</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">税率</th>
            <th className="py-2 px-3 border border-gray-200"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="py-6 text-center text-black text-sm border border-gray-200">
                データがありません
              </td>
            </tr>
          ) : (
            filtered.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {editingId === row.id ? (
                  <>
                    <td className="py-1 px-2 border border-gray-200">
                      <input value={editPartner} onChange={(e) => setEditPartner(e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input value={editDetail} onChange={(e) => setEditDetail(e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input type="number" value={editExpected} onChange={(e) => setEditExpected(Number(e.target.value))}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-right bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input type="number" value={editReceived} onChange={(e) => setEditReceived(Number(e.target.value))}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-right bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <select value={editPayment} onChange={(e) => setEditPayment(e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white">
                        {PAYMENTS.filter((p) => p !== "選択してください").map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <select value={editTaxRate} onChange={(e) => setEditTaxRate(e.target.value)}
                        className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white">
                        {TAX_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(row.id)}
                          className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: "#006a38" }}>
                          保存
                        </button>
                        <button onClick={() => setEditingId(null)}
                          className="text-xs text-black px-2 py-0.5 rounded border border-gray-200">
                          キャンセル
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-3 text-black border border-gray-200">{row.partner}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{row.detail}</td>
                    <td className="py-2 px-3 text-right text-black border border-gray-200">{(row.expected_amount ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-black border border-gray-200">{(row.received_amount ?? 0).toLocaleString()}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{row.payment}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{row.tax_rate}</td>
                    <td className="py-2 px-3 border border-gray-200">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(row)} className="text-xs text-blue-500 hover:text-blue-700">編集</button>
                        <button onClick={() => handleDelete(row.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
