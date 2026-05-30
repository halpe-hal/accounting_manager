"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDefaultPartner, deleteDefaultPartner, updateDefaultPartner } from "@/app/actions/settings";
import type { Division, ExpenseCategory, DefaultPartner, AccountItem } from "@/lib/types";
import { sortDivisionsByBrand, divisionDisplayName } from "@/lib/division-utils";

interface Props {
  divisions: Division[];
  expenseCategories: ExpenseCategory[];
  accountItems: AccountItem[];
  initial: DefaultPartner[];
}

const PAYMENTS = ["選択してください", "現金", "クレジットカード", "銀行振込", "銀行引落", "その他"];

export default function DefaultPartnersTab({ divisions, expenseCategories, accountItems, initial }: Props) {
  const router = useRouter();
  const sortedDivs = sortDivisionsByBrand(divisions);
  const [items, setItems] = useState(initial);
  useEffect(() => { setItems(initial); }, [initial]);
  const [activeDiv, setActiveDiv] = useState(sortedDivs[0]?.name ?? "");
  const [activeCat, setActiveCat] = useState("");
  const [partner, setPartner] = useState("");
  const [account, setAccount] = useState(accountItems[0]?.name ?? "");
  const [detail, setDetail] = useState("");
  const [payment, setPayment] = useState(PAYMENTS[0]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPartner, setEditPartner] = useState("");
  const [editAccount, setEditAccount] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [isPending, startTransition] = useTransition();
  const [permError, setPermError] = useState<string | null>(null);

  const divCategories = expenseCategories;
  const effectiveCat = activeCat || divCategories[0]?.name || "";

  const filteredItems = items.filter(
    (p) => p.top_category === activeDiv && p.second_category === effectiveCat
  );

  async function handleAdd() {
    if (!partner.trim() || !effectiveCat) return;
    startTransition(async () => {
      const result = await addDefaultPartner({
        partner: partner.trim(),
        top_category: activeDiv,
        second_category: effectiveCat,
        account,
        detail,
        payment: payment === "選択してください" ? "" : payment,
      });
      if (result?.error) { setPermError(result.error); return; }
      setPartner(""); setDetail("");
      router.refresh();
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("削除しますか？")) return;
    const result = await deleteDefaultPartner(id);
    if (result?.error) { setPermError(result.error); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function startEdit(p: DefaultPartner) {
    setEditingId(p.id);
    setEditPartner(p.partner);
    setEditAccount(p.account);
    setEditDetail(p.detail ?? "");
    setEditPayment(p.payment);
  }

  async function handleUpdate(id: number) {
    const result = await updateDefaultPartner(id, { partner: editPartner, account: editAccount, detail: editDetail, payment: editPayment });
    if (result?.error) { setPermError(result.error); return; }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-black mb-4">取引先デフォルト設定</h2>
      {permError && <div className="mb-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">{permError}<button onClick={() => setPermError(null)} className="text-red-400">×</button></div>}

      {/* 事業部タブ */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
        {sortedDivs.map((d) => (
          <button
            key={d.id}
            onClick={() => { setActiveDiv(d.name); setActiveCat(""); }}
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

      {/* 費目タブ */}
      {divCategories.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
          {divCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.name)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                effectiveCat === c.name
                  ? "text-white"
                  : "bg-white border border-gray-200 text-black hover:bg-gray-50"
              }`}
              style={effectiveCat === c.name ? { backgroundColor: "#4b5563" } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* 追加フォーム */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-xs font-semibold text-black mb-2">{effectiveCat}カテゴリに新規登録</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div>
            <label className="block text-xs text-black mb-0.5">取引先（必須）</label>
            <input
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
              placeholder="例：三和"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">勘定科目</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            >
              {accountItems.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">詳細</label>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="例：厨房仕入"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-0.5">支払方法</label>
            <select
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none"
            >
              {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={isPending || !partner.trim()}
            className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#006a38" }}
          >
            登録
          </button>
        </div>
      </div>

      {/* 一覧 */}
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-xs text-black">
            <th className="py-2 px-3 text-left font-medium border border-gray-200">取引先</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">勘定科目</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">詳細</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">支払方法</th>
            <th className="py-2 px-3 border border-gray-200"></th>
          </tr>
        </thead>
        <tbody>
          {filteredItems.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-black text-sm border border-gray-200">
                データがありません
              </td>
            </tr>
          ) : (
            filteredItems.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50">
                {editingId === p.id ? (
                  <>
                    <td className="py-2 px-3 border border-gray-200">
                      <input value={editPartner} onChange={(e) => setEditPartner(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </td>
                    <td className="py-2 px-3 border border-gray-200">
                      <select value={editAccount} onChange={(e) => setEditAccount(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white">
                        {accountItems.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                      </select>
                    </td>
                    <td className="py-2 px-3 border border-gray-200">
                      <input value={editDetail} onChange={(e) => setEditDetail(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </td>
                    <td className="py-2 px-3 border border-gray-200">
                      <select value={editPayment} onChange={(e) => setEditPayment(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white">
                        {PAYMENTS.filter((pm) => pm !== "選択してください").map((pm) => (
                          <option key={pm} value={pm}>{pm}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-3 border border-gray-200">
                      <div className="flex gap-1">
                        <button onClick={() => handleUpdate(p.id)}
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
                    <td className="py-2 px-3 text-black border border-gray-200">{p.partner}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{p.account}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{p.detail}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{p.payment}</td>
                    <td className="py-2 px-3 border border-gray-200">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(p)} className="text-xs text-blue-500 hover:text-blue-700">編集</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
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
