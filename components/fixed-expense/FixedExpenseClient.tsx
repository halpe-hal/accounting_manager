"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addFixedCategory, updateFixedCategory, deleteFixedCategory } from "@/app/actions/settings";
import type { Division, FixedCategory, ExpenseCategory, AccountItem } from "@/lib/types";
import { sortDivisionsByBrand, divisionDisplayName } from "@/lib/division-utils";

interface Props {
  divisions: Division[];
  fixedCategories: FixedCategory[];
  expenseCategories: ExpenseCategory[];
  accountItems: AccountItem[];
}

const PAYMENTS = ["現金", "クレジットカード", "銀行振込", "銀行引落", "その他"];

export default function FixedExpenseClient({
  divisions,
  fixedCategories: initial,
  expenseCategories,
  accountItems,
}: Props) {
  const router = useRouter();
  const sortedDivs = sortDivisionsByBrand(divisions);
  const [items, setItems] = useState(initial);
  useEffect(() => { setItems(initial); }, [initial]);
  const [selectedDiv, setSelectedDiv] = useState(sortedDivs[0]?.name ?? "");
  const [showForm, setShowForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSecondCategory, setEditSecondCategory] = useState("");
  const [editPartner, setEditPartner] = useState("");
  const [editAccount, setEditAccount] = useState("");
  const [editDetail, setEditDetail] = useState("");
  const [editPayment, setEditPayment] = useState("");
  const [editCost, setEditCost] = useState(0);

  const filtered = items.filter((i) => i.top_category === selectedDiv);
  const total = filtered.reduce((sum, i) => sum + (i.cost ?? 0), 0);

  const categoryTotals = expenseCategories
    .map((c) => ({
      name: c.name,
      total: filtered.filter((i) => i.second_category === c.name).reduce((sum, i) => sum + (i.cost ?? 0), 0),
    }))
    .filter((c) => c.total > 0);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addFixedCategory({
        top_category: selectedDiv,
        second_category: fd.get("second_category") as string,
        partner: fd.get("partner") as string,
        account: fd.get("account") as string,
        detail: fd.get("detail") as string,
        cost: Number(fd.get("cost")),
        payment: fd.get("payment") as string,
      });
      if (result?.error) { setErrorMsg(result.error); return; }
      setShowForm(false);
      router.refresh();
    });
  }

  function startEdit(item: FixedCategory) {
    setEditingId(item.id);
    setEditSecondCategory(item.second_category);
    setEditPartner(item.partner);
    setEditAccount(item.account);
    setEditDetail(item.detail ?? "");
    setEditPayment(item.payment);
    setEditCost(item.cost ?? 0);
  }

  async function handleUpdate(id: number) {
    const result = await updateFixedCategory(id, {
      top_category: selectedDiv,
      second_category: editSecondCategory,
      partner: editPartner,
      account: editAccount,
      detail: editDetail,
      payment: editPayment,
      cost: editCost,
    });
    if (result?.error) { setErrorMsg(result.error); return; }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("削除しますか？")) return;
    const result = await deleteFixedCategory(id);
    if (result?.error) { setErrorMsg(result.error); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">固定費管理</h1>
      {errorMsg && (
        <div className="mb-4 px-4 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">
          {errorMsg}
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600">×</button>
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">事業部</label>
          <select
            value={selectedDiv}
            onChange={(e) => setSelectedDiv(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            {sortedDivs.map((d) => (
              <option key={d.id} value={d.name}>{divisionDisplayName(d)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 集計 */}
      {categoryTotals.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 mb-4">
          <div className="px-4 py-2 border-b border-gray-200 bg-gray-50 rounded-t-2xl">
            <span className="text-xs font-semibold text-gray-500">費目別合計</span>
          </div>
          <table className="w-full text-sm border-collapse">
            <tbody>
              {categoryTotals.map((c) => (
                <tr key={c.name}>
                  <td className="py-1.5 px-4 text-black border border-gray-200">{c.name}</td>
                  <td className="py-1.5 px-4 text-right text-black border border-gray-200">¥{Math.round(c.total).toLocaleString("ja-JP")}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td className="py-2 px-4 text-black border border-gray-200">合計</td>
                <td className="py-2 px-4 text-right text-black border border-gray-200">¥{Math.round(total).toLocaleString("ja-JP")}/月</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div className="text-sm font-semibold text-gray-700">
            固定費一覧
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: "#006a38" }}
          >
            + 追加
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="p-4 border-b border-gray-200 bg-gray-50 grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">費目カテゴリ</label>
              <select name="second_category" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">取引先</label>
              <input name="partner" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">勘定科目</label>
              <select name="account" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                {accountItems.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">詳細</label>
              <input name="detail" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">支払方法</label>
              <select name="payment" className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none">
                {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">金額（月額）</label>
              <input name="cost" type="number" defaultValue={0} className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none" />
            </div>
            <div className="col-span-2 flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg">キャンセル</button>
              <button type="submit" disabled={isPending} className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: "#006a38" }}>
                {isPending ? "保存中..." : "保存"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500">
                <th className="py-2 px-3 text-left font-medium border border-gray-200">費目カテゴリ</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">取引先</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">勘定科目</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">詳細</th>
                <th className="py-2 px-3 text-left font-medium border border-gray-200">支払方法</th>
                <th className="py-2 px-3 text-right font-medium border border-gray-200">金額</th>
                <th className="py-2 px-3 border border-gray-200"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 text-sm">データがありません</td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    {editingId === item.id ? (
                      <>
                        <td className="py-1 px-2 border border-gray-200">
                          <select value={editSecondCategory} onChange={(e) => setEditSecondCategory(e.target.value)}
                            className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white">
                            {expenseCategories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className="py-1 px-2 border border-gray-200">
                          <input value={editPartner} onChange={(e) => setEditPartner(e.target.value)}
                            className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white" />
                        </td>
                        <td className="py-1 px-2 border border-gray-200">
                          <select value={editAccount} onChange={(e) => setEditAccount(e.target.value)}
                            className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white">
                            {accountItems.map((a) => <option key={a.id} value={a.name}>{a.name}</option>)}
                          </select>
                        </td>
                        <td className="py-1 px-2 border border-gray-200">
                          <input value={editDetail} onChange={(e) => setEditDetail(e.target.value)}
                            className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white" />
                        </td>
                        <td className="py-1 px-2 border border-gray-200">
                          <select value={editPayment} onChange={(e) => setEditPayment(e.target.value)}
                            className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm bg-white">
                            {PAYMENTS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </td>
                        <td className="py-1 px-2 border border-gray-200">
                          <input type="number" value={editCost} onChange={(e) => setEditCost(Number(e.target.value))}
                            className="w-full border border-gray-200 rounded px-1 py-0.5 text-sm text-right bg-white" />
                        </td>
                        <td className="py-1 px-2 border border-gray-200">
                          <div className="flex gap-1">
                            <button onClick={() => handleUpdate(item.id)}
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
                        <td className="py-2 px-3 text-gray-700 border border-gray-200">{item.second_category}</td>
                        <td className="py-2 px-3 text-gray-500 border border-gray-200">{item.partner}</td>
                        <td className="py-2 px-3 text-gray-500 border border-gray-200">{item.account}</td>
                        <td className="py-2 px-3 text-gray-500 border border-gray-200">{item.detail}</td>
                        <td className="py-2 px-3 text-gray-500 border border-gray-200">{item.payment}</td>
                        <td className="py-2 px-3 text-right text-gray-800 font-medium border border-gray-200">¥{(item.cost ?? 0).toLocaleString()}</td>
                        <td className="py-2 px-3 border border-gray-200">
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(item)} className="text-xs text-blue-500 hover:text-blue-700">編集</button>
                            <button onClick={() => handleDelete(item.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
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
      </div>
    </div>
  );
}
