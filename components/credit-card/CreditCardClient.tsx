"use client";

import { useState, useRef } from "react";
import { parseCardCsv } from "./parseCardCsv";
import type { CardRecord } from "./parseCardCsv";
import RegisterModal, { recordKey } from "./RegisterModal";
import BatchRegisterModal from "./BatchRegisterModal";

type GroupKey = { year: number; month: number; user: string; card: string };

function groupRecords(records: CardRecord[]) {
  const map = new Map<string, CardRecord[]>();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}__${r.card}__${r.user}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function formatYen(n: number) {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

export default function CreditCardClient() {
  const [records, setRecords] = useState<CardRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [registeredKeys, setRegisteredKeys] = useState<Set<string>>(new Set());
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [registerTarget, setRegisterTarget] = useState<CardRecord | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [filterMonth, setFilterMonth] = useState<number | "all">("all");
  const [filterCard, setFilterCard] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newErrors: string[] = [];
    const newRecords: CardRecord[] = [];

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = parseCardCsv(file.name, text);
        if (result.error || !result.records) {
          newErrors.push(`${file.name}: ${result.error}`);
          setErrors((prev) => [...prev, `${file.name}: ${result.error}`]);
        } else {
          setRecords((prev) => {
            const merged = [...prev, ...result.records];
            merged.sort((a, b) =>
              a.year !== b.year ? a.year - b.year :
              a.month !== b.month ? a.month - b.month :
              a.date.localeCompare(b.date)
            );
            return merged;
          });
        }
      };
      reader.readAsText(file, "Shift_JIS");
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleClear() {
    setRecords([]);
    setErrors([]);
    setRegisteredKeys(new Set());
    setCheckedKeys(new Set());
    setFilterYear("all");
    setFilterMonth("all");
    setFilterCard("all");
    setFilterUser("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRegisterSuccess(keys: string[]) {
    setRegisteredKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.add(k));
      return next;
    });
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => next.delete(k));
      return next;
    });
    setRegisterTarget(null);
    setBatchOpen(false);
  }

  function toggleCheck(key: string) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleGroupCheck(groupKeys: string[]) {
    const unregistered = groupKeys.filter((k) => !registeredKeys.has(k));
    const allChecked = unregistered.every((k) => checkedKeys.has(k));
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (allChecked) unregistered.forEach((k) => next.delete(k));
      else unregistered.forEach((k) => next.add(k));
      return next;
    });
  }

  const selectedRecords = records.filter((r) => checkedKeys.has(recordKey(r)));
  const selectedTotal = selectedRecords.reduce((s, r) => s + r.amount, 0);

  const years = [...new Set(records.map((r) => r.year))].sort();
  const months = [...new Set(records.map((r) => r.month))].sort((a, b) => a - b);
  const cards = [...new Set(records.map((r) => r.card))].sort();
  const users = [...new Set(records.map((r) => r.user))].sort();

  const filtered = records.filter((r) => {
    if (filterYear !== "all" && r.year !== filterYear) return false;
    if (filterMonth !== "all" && r.month !== filterMonth) return false;
    if (filterCard !== "all" && r.card !== filterCard) return false;
    if (filterUser !== "all" && r.user !== filterUser) return false;
    return true;
  });

  const grouped = groupRecords(filtered);
  const sortedGroupKeys = [...grouped.keys()].sort();

  const grandTotal = filtered.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">クレカ明細取込</h1>

      {registerTarget && (
        <RegisterModal
          record={registerTarget}
          allRecords={records}
          registeredKeys={registeredKeys}
          onClose={() => setRegisterTarget(null)}
          onSuccess={handleRegisterSuccess}
        />
      )}

      {batchOpen && selectedRecords.length > 0 && (
        <BatchRegisterModal
          selectedRecords={selectedRecords}
          onClose={() => setBatchOpen(false)}
          onSuccess={handleRegisterSuccess}
        />
      )}

      {/* アップロードエリア */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-colors ${
          isDragging ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
        }`}
      >
        <p className="text-sm text-gray-500">CSVファイルをドラッグ＆ドロップ、またはクリックして選択</p>
        <p className="text-xs text-gray-400 mt-1">複数ファイル同時アップロード可</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-red-700">{e}</p>
          ))}
        </div>
      )}

      {records.length > 0 && (
        <>
          {/* フィルター */}
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">年</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                <option value="all">すべて</option>
                {years.map((y) => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">月</label>
              <select
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                <option value="all">すべて</option>
                {months.map((m) => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">カード</label>
              <select
                value={filterCard}
                onChange={(e) => setFilterCard(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                <option value="all">すべて</option>
                {cards.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">利用者</label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
              >
                <option value="all">すべて</option>
                {users.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">{filtered.length}件</span>
              <button
                onClick={handleClear}
                className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                クリア
              </button>
            </div>
          </div>

          {/* 明細テーブル */}
          {sortedGroupKeys.map((groupKey) => {
            const rows = grouped.get(groupKey)!;
            const [yearMonth, card, user] = groupKey.split("__");
            const [y, m] = yearMonth.split("-");
            const subtotal = rows.reduce((s, r) => s + r.amount, 0);
            const groupRecordKeys = rows.map((r) => recordKey(r));
            const unregisteredKeys = groupRecordKeys.filter((k) => !registeredKeys.has(k));
            const allGroupChecked = unregisteredKeys.length > 0 && unregisteredKeys.every((k) => checkedKeys.has(k));
            const someGroupChecked = unregisteredKeys.some((k) => checkedKeys.has(k));
            return (
              <div key={groupKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    {unregisteredKeys.length > 0 && (
                      <input
                        type="checkbox"
                        checked={allGroupChecked}
                        ref={(el) => { if (el) el.indeterminate = someGroupChecked && !allGroupChecked; }}
                        onChange={() => toggleGroupCheck(groupRecordKeys)}
                        className="rounded border-gray-300 cursor-pointer"
                        title="グループ全選択"
                      />
                    )}
                    <span className="font-semibold text-sm text-gray-800">{y}年{Number(m)}月</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{card}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{user}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{formatYen(subtotal)}</span>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="py-2 px-3 border-b border-gray-200 w-8" />
                      <th className="py-2 px-4 text-left font-medium border-b border-gray-200">利用日</th>
                      <th className="py-2 px-4 text-left font-medium border-b border-gray-200">利用店名</th>
                      <th className="py-2 px-4 text-right font-medium border-b border-gray-200">金額</th>
                      {rows.some((r) => r.memo) && (
                        <th className="py-2 px-4 text-left font-medium border-b border-gray-200">備考</th>
                      )}
                      <th className="py-2 px-3 border-b border-gray-200" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const rKey = recordKey(r);
                      const registered = registeredKeys.has(rKey);
                      const checked = checkedKeys.has(rKey);
                      return (
                        <tr
                          key={i}
                          className={
                            registered ? "bg-green-50" :
                            checked ? "bg-blue-50" :
                            "hover:bg-gray-50"
                          }
                        >
                          <td className="py-1.5 px-3 border-b border-gray-100 text-center">
                            {!registered && (
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCheck(rKey)}
                                className="rounded border-gray-300 cursor-pointer"
                              />
                            )}
                          </td>
                          <td className="py-1.5 px-4 text-gray-700 border-b border-gray-100">{r.date}</td>
                          <td className="py-1.5 px-4 text-gray-700 border-b border-gray-100">{r.description}</td>
                          <td className="py-1.5 px-4 text-right text-gray-800 border-b border-gray-100">{formatYen(r.amount)}</td>
                          {rows.some((rr) => rr.memo) && (
                            <td className="py-1.5 px-4 text-gray-500 border-b border-gray-100 text-xs">{r.memo ?? ""}</td>
                          )}
                          <td className="py-1.5 px-3 border-b border-gray-100 text-right">
                            {registered ? (
                              <span className="text-xs text-green-600 font-medium">登録済み</span>
                            ) : (
                              <button
                                onClick={() => setRegisterTarget(r)}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100 whitespace-nowrap"
                              >
                                登録
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}

          {/* フローティング一括登録バー */}
          {checkedKeys.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-2xl px-5 py-3 flex items-center gap-4 z-40">
              <span className="text-sm text-gray-700">
                <strong>{checkedKeys.size}件</strong>選択中
                <span className="text-gray-400 ml-2">合計 {formatYen(selectedTotal)}</span>
              </span>
              <button
                onClick={() => setCheckedKeys(new Set())}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                解除
              </button>
              <button
                onClick={() => setBatchOpen(true)}
                className="text-sm px-4 py-2 text-white rounded-xl"
                style={{ backgroundColor: "#006a38" }}
              >
                まとめて登録
              </button>
            </div>
          )}

          {/* 合計 */}
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex justify-between items-center">
            <span className="font-semibold text-sm text-gray-800">合計</span>
            <span className="font-bold text-gray-800">{formatYen(grandTotal)}</span>
          </div>
        </>
      )}
    </div>
  );
}
