"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addDivision, deleteDivision, updateDivision, updateDivisionSortOrder } from "@/app/actions/settings";
import type { Division } from "@/lib/types";

function displayName(d: { name: string; tag?: string | null }): string {
  return d.tag ? `[${d.tag}]-${d.name}` : d.name;
}

export default function DivisionsTab({ initial }: { initial: Division[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  useEffect(() => { setItems(initial); }, [initial]);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [brand, setBrand] = useState("");
  const [tag, setTag] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editError, setEditError] = useState("");

  async function handleAdd() {
    if (!name.trim()) return;
    setError("");
    startTransition(async () => {
      const result = await addDivision(
        name.trim(),
        type.trim() || undefined,
        brand.trim() || undefined,
        tag.trim() || undefined
      );
      if (result && typeof result === "object" && "error" in result) { setError(result.error); return; }
      if (result === "duplicate") { setError("同じ名前の事業部がすでに存在します。"); return; }
      setName(""); setType(""); setBrand(""); setTag("");
      router.refresh();
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("削除しますか？")) return;
    const result = await deleteDivision(id);
    if (result?.error) { setError(result.error); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  async function handleSort(id: number, direction: "up" | "down") {
    const result = await updateDivisionSortOrder(id, direction);
    if (result?.error) { setError(result.error); return; }
    router.refresh();
  }

  function startEdit(d: Division) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditType(d.type ?? "");
    setEditBrand(d.brand ?? "");
    setEditTag(d.tag ?? "");
    setEditError("");
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) { setEditError("事業部・店舗名は必須です。"); return; }
    setEditError("");
    const result = await updateDivision(id, {
      name: editName.trim(),
      type: editType.trim() || null,
      brand: editBrand.trim() || null,
      tag: editTag.trim() || null,
    });
    if (result?.error) { setEditError(result.error); return; }
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-black mb-4">事業部・店舗設定</h2>

      {/* 新規登録フォーム */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
        <h3 className="text-xs font-semibold text-black mb-3">新規登録</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-black mb-1">事業部・店舗名 <span className="text-red-500">*</span></label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例：H.A.L. cafe 渋谷店"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-1">タグ（任意）</label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="例：店舗、事務所"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-1">業態（任意）</label>
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="例：カフェ、レストラン"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-black mb-1">ブランド（任意）</label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="例：H.A.L. cafe"
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
        </div>
        {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd}
            disabled={isPending || !name.trim()}
            className="px-4 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
            style={{ backgroundColor: "#006a38" }}
          >
            {isPending ? "登録中..." : "登録"}
          </button>
          {tag && (
            <span className="text-xs text-gray-500">
              表示名: <strong className="text-black">[{tag}]-{name || "（名称）"}</strong>
            </span>
          )}
        </div>
      </div>

      {/* 一覧 */}
      <h3 className="text-xs font-semibold text-black mb-2">登録済みの事業部・店舗</h3>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-xs text-black">
            <th className="py-2 px-3 text-left font-medium border border-gray-200">表示名</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">タグ</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">業態</th>
            <th className="py-2 px-3 text-left font-medium border border-gray-200">ブランド</th>
            <th className="py-2 px-3 border border-gray-200"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-6 text-center text-black text-sm border border-gray-200">
                データがありません
              </td>
            </tr>
          ) : (
            items.map((d, idx) => (
              <tr key={d.id} className="hover:bg-gray-50">
                {editingId === d.id ? (
                  <>
                    <td className="py-1 px-2 border border-gray-200">
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input value={editTag} onChange={(e) => setEditTag(e.target.value)}
                        placeholder="タグ"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input value={editType} onChange={(e) => setEditType(e.target.value)}
                        placeholder="業態"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <input value={editBrand} onChange={(e) => setEditBrand(e.target.value)}
                        placeholder="ブランド"
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white" />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <div className="flex flex-col gap-1">
                        <div className="flex gap-1">
                          <button onClick={() => handleUpdate(d.id)}
                            className="text-xs text-white px-2 py-0.5 rounded" style={{ backgroundColor: "#006a38" }}>
                            保存
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="text-xs text-black px-2 py-0.5 rounded border border-gray-200">
                            キャンセル
                          </button>
                        </div>
                        {editError && <p className="text-red-500 text-xs">{editError}</p>}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-3 text-black font-medium border border-gray-200">{displayName(d)}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{d.tag ?? "—"}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{d.type ?? "—"}</td>
                    <td className="py-2 px-3 text-black border border-gray-200">{d.brand ?? "—"}</td>
                    <td className="py-2 px-3 border border-gray-200">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleSort(d.id, "up")} disabled={idx === 0}
                          className="text-xs text-black hover:text-gray-600 disabled:opacity-30 px-1">↑</button>
                        <button onClick={() => handleSort(d.id, "down")} disabled={idx === items.length - 1}
                          className="text-xs text-black hover:text-gray-600 disabled:opacity-30 px-1">↓</button>
                        <button onClick={() => startEdit(d)} className="text-xs text-blue-500 hover:text-blue-700 ml-1">編集</button>
                        <button onClick={() => handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600 ml-1">削除</button>
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
