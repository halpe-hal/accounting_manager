"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { addAccountItem, updateAccountItem, deleteAccountItem } from "@/app/actions/settings";
import type { AccountItem } from "@/lib/types";

export default function AccountItemsTab({ initial }: { initial: AccountItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  useEffect(() => { setItems(initial); }, [initial]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [permError, setPermError] = useState<string | null>(null);

  async function handleAdd() {
    if (!name.trim()) return;
    startTransition(async () => {
      const result = await addAccountItem(name.trim());
      if (result && typeof result === "object" && "error" in result) { setPermError(result.error); return; }
      setName("");
      router.refresh();
    });
  }

  function startEdit(a: AccountItem) {
    setEditingId(a.id);
    setEditName(a.name);
  }

  async function handleUpdate(id: number) {
    if (!editName.trim()) return;
    const result = await updateAccountItem(id, editName.trim());
    if (result?.error) { setPermError(result.error); return; }
    setEditingId(null);
    router.refresh();
  }

  async function handleDelete(id: number) {
    if (!confirm("削除しますか？")) return;
    const result = await deleteAccountItem(id);
    if (result?.error) { setPermError(result.error); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-black mb-4">勘定科目設定</h2>
      {permError && <div className="mb-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">{permError}<button onClick={() => setPermError(null)} className="text-red-400">×</button></div>}

      <div className="flex gap-2 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="科目名"
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
        />
        <button
          onClick={handleAdd}
          disabled={isPending || !name.trim()}
          className="px-3 py-1.5 text-sm text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: "#006a38" }}
        >
          追加
        </button>
      </div>

      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-xs text-black">
            <th className="py-2 px-3 text-left font-medium border border-gray-200">名称</th>
            <th className="py-2 px-3 border border-gray-200"></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={2} className="py-6 text-center text-black text-sm border border-gray-200">データがありません</td>
            </tr>
          ) : (
            items.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                {editingId === a.id ? (
                  <>
                    <td className="py-1 px-2 border border-gray-200">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1 text-sm bg-white"
                      />
                    </td>
                    <td className="py-1 px-2 border border-gray-200">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleUpdate(a.id)}
                          className="text-xs text-white px-2 py-0.5 rounded"
                          style={{ backgroundColor: "#006a38" }}
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-black px-2 py-0.5 rounded border border-gray-200"
                        >
                          キャンセル
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="py-2 px-3 text-black border border-gray-200">{a.name}</td>
                    <td className="py-2 px-3 border border-gray-200">
                      <div className="flex gap-2">
                        <button onClick={() => startEdit(a)} className="text-xs text-blue-500 hover:text-blue-700">編集</button>
                        <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:text-red-600">削除</button>
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
