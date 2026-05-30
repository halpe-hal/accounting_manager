"use client";

import { useState, useRef } from "react";
import { parseBankCsv, bankRecordKey } from "./parseBankCsv";
import type { BankRecord } from "./parseBankCsv";
import BankRegisterModal from "./BankRegisterModal";
import BankDepositModal from "./BankDepositModal";

function groupRecords(records: BankRecord[]) {
  const map = new Map<string, BankRecord[]>();
  for (const r of records) {
    const key = `${r.year}-${String(r.month).padStart(2, "0")}__${r.bank}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  return map;
}

function formatYen(n: number) { return `¥${Math.round(n).toLocaleString("ja-JP")}`; }

type RegisterTarget = { record: BankRecord; allKeys: string[]; totalAmount: number };

export default function BankClient() {
  const [records, setRecords] = useState<BankRecord[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [registeredKeys, setRegisteredKeys] = useState<Set<string>>(new Set());
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  const [registerTarget, setRegisterTarget] = useState<RegisterTarget | null>(null);
  const [depositTarget, setDepositTarget] = useState<BankRecord | null>(null);
  const idxRef = useRef(0);
  const [filterYear, setFilterYear] = useState<number | "all">("all");
  const [filterMonth, setFilterMonth] = useState<number | "all">("all");
  const [filterBank, setFilterBank] = useState<string>("all");
  const [filterType, setFilterType] = useState<"all" | "withdrawal" | "deposit">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function processContent(filename: string, content: string) {
    const result = parseBankCsv(filename, content);
    if (result.error || result.records.length === 0) {
      setErrors((prev) => [...prev, `${filename}: ${result.error ?? "明細なし"}`]);
    } else {
      const withIdx = result.records.map((r) => ({ ...r, _idx: idxRef.current++ }));
      setRecords((prev) => {
        const merged = [...prev, ...withIdx];
        merged.sort((a, b) =>
          a.year !== b.year ? a.year - b.year :
          a.month !== b.month ? a.month - b.month :
          a.date.localeCompare(b.date)
        );
        return merged;
      });
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      // まず UTF-8 で試し読みして三井住友（UTF-8 BOM）か判定する
      const r1 = new FileReader();
      r1.onload = (e) => {
        const utf8 = e.target?.result as string;
        // BOM付きUTF-8ファイルのみUTF-8として扱う（三井住友の旧形式等）
      // 新三井住友はShift-JISなのでこのチェックには引っかからない
      const isSMBC = utf8.charCodeAt(0) === 0xFEFF;
        if (isSMBC) {
          processContent(file.name, utf8.replace(/^﻿/, ""));
        } else {
          // その他の銀行は Shift-JIS で再読み
          const r2 = new FileReader();
          r2.onload = (e2) => processContent(file.name, e2.target?.result as string);
          r2.readAsText(file, "Shift_JIS");
        }
      };
      r1.readAsText(file, "UTF-8");
    });
  }

  function handleClear() {
    setRecords([]); setErrors([]); setRegisteredKeys(new Set()); setCheckedKeys(new Set());
    setFilterYear("all"); setFilterMonth("all"); setFilterBank("all"); setFilterType("all");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSuccess(keys: string[]) {
    setRegisteredKeys((prev) => new Set([...prev, ...keys]));
    setCheckedKeys((prev) => { const n = new Set(prev); keys.forEach((k) => n.delete(k)); return n; });
    setRegisterTarget(null);
    setDepositTarget(null);
  }

  function toggleCheck(key: string, r: BankRecord) {
    if (r.type !== "withdrawal") return;
    setCheckedKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) {
        n.delete(key);
      } else {
        // チェック時: 同日・同摘要・同銀行の出金を全てグループ選択
        n.add(key);
        records.forEach((rec) => {
          if (
            rec.type === "withdrawal" &&
            rec.date === r.date &&
            rec.description === r.description &&
            rec.bank === r.bank &&
            !registeredKeys.has(bankRecordKey(rec))
          ) {
            n.add(bankRecordKey(rec));
          }
        });
      }
      return n;
    });
  }

  function toggleGroupCheck(groupKeys: string[]) {
    const unregistered = groupKeys.filter((k) => !registeredKeys.has(k));
    const allChecked = unregistered.length > 0 && unregistered.every((k) => checkedKeys.has(k));
    setCheckedKeys((prev) => {
      const n = new Set(prev);
      if (allChecked) unregistered.forEach((k) => n.delete(k));
      else unregistered.forEach((k) => n.add(k));
      return n;
    });
  }

  const years = [...new Set(records.map((r) => r.year))].sort();
  const months = [...new Set(records.map((r) => r.month))].sort((a, b) => a - b);
  const banks = [...new Set(records.map((r) => r.bank))].sort();

  const filtered = records.filter((r) => {
    if (filterYear !== "all" && r.year !== filterYear) return false;
    if (filterMonth !== "all" && r.month !== filterMonth) return false;
    if (filterBank !== "all" && r.bank !== filterBank) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  const grouped = groupRecords(filtered);
  const sortedGroupKeys = [...grouped.keys()].sort();

  const selectedRecords = records.filter((r) => checkedKeys.has(bankRecordKey(r)));
  const selectedTotal = selectedRecords.reduce((s, r) => s + r.amount, 0);

  const withdrawalTotal = filtered.filter((r) => r.type === "withdrawal").reduce((s, r) => s + r.amount, 0);
  const depositTotal = filtered.filter((r) => r.type === "deposit").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">銀行明細取込</h1>

      {registerTarget && (
        <BankRegisterModal
          record={registerTarget.record}
          allKeys={registerTarget.allKeys}
          totalAmount={registerTarget.totalAmount}
          onClose={() => setRegisterTarget(null)}
          onSuccess={handleSuccess}
        />
      )}
      {depositTarget && (
        <BankDepositModal record={depositTarget} onClose={() => setDepositTarget(null)} onSuccess={handleSuccess} />
      )}

      {/* アップロードエリア */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl px-6 py-10 text-center cursor-pointer transition-colors ${
          isDragging ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
        }`}
      >
        <p className="text-sm text-gray-500">CSVファイルをドラッグ＆ドロップ、またはクリックして選択</p>
        <p className="text-xs text-gray-400 mt-1">対応銀行：城南信用金庫・昭和信用金庫・住信SBIネット銀行・三井住友銀行</p>
        <input ref={fileInputRef} type="file" accept=".csv" multiple className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-1">
          {errors.map((e, i) => <p key={i} className="text-sm text-red-700">{e}</p>)}
        </div>
      )}

      {records.length > 0 && (
        <>
          {/* フィルター */}
          <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3 flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">年</label>
              <select value={filterYear} onChange={(e) => setFilterYear(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                <option value="all">すべて</option>
                {years.map((y) => <option key={y} value={y}>{y}年</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">月</label>
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                <option value="all">すべて</option>
                {months.map((m) => <option key={m} value={m}>{m}月</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">銀行</label>
              <select value={filterBank} onChange={(e) => setFilterBank(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                <option value="all">すべて</option>
                {banks.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">種別</label>
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as "all" | "withdrawal" | "deposit")}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none">
                <option value="all">すべて</option>
                <option value="withdrawal">出金のみ</option>
                <option value="deposit">入金のみ</option>
              </select>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-sm text-gray-500">{filtered.length}件</span>
              <button onClick={handleClear} className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">クリア</button>
            </div>
          </div>

          {/* 合計サマリー */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">出金合計</p>
              <p className="text-lg font-bold text-red-700">▼ {formatYen(withdrawalTotal)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-500 mb-1">入金合計</p>
              <p className="text-lg font-bold text-green-700">▲ {formatYen(depositTotal)}</p>
            </div>
          </div>

          {/* 明細グループ */}
          {sortedGroupKeys.map((groupKey) => {
            const rows = grouped.get(groupKey)!;
            const [yearMonth, bank] = groupKey.split("__");
            const [y, m] = yearMonth.split("-");
            const withdrawalKeys = rows.filter((r) => r.type === "withdrawal" && !registeredKeys.has(bankRecordKey(r))).map((r) => bankRecordKey(r));
            const allGroupChecked = withdrawalKeys.length > 0 && withdrawalKeys.every((k) => checkedKeys.has(k));
            const someGroupChecked = withdrawalKeys.some((k) => checkedKeys.has(k));
            const groupWithdrawal = rows.filter((r) => r.type === "withdrawal").reduce((s, r) => s + r.amount, 0);
            const groupDeposit = rows.filter((r) => r.type === "deposit").reduce((s, r) => s + r.amount, 0);
            return (
              <div key={groupKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <div className="flex items-center gap-3">
                    {withdrawalKeys.length > 0 && (
                      <input type="checkbox" checked={allGroupChecked}
                        ref={(el) => { if (el) el.indeterminate = someGroupChecked && !allGroupChecked; }}
                        onChange={() => toggleGroupCheck(withdrawalKeys)}
                        className="rounded border-gray-300 cursor-pointer" title="出金を全選択" />
                    )}
                    <span className="font-semibold text-sm text-gray-800">{y}年{Number(m)}月</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{bank}</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    {groupDeposit > 0 && <span className="text-green-700">▲ {formatYen(groupDeposit)}</span>}
                    {groupWithdrawal > 0 && <span className="text-red-700">▼ {formatYen(groupWithdrawal)}</span>}
                  </div>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500">
                      <th className="py-2 px-3 border-b border-gray-200 w-8" />
                      <th className="py-2 px-4 text-left font-medium border-b border-gray-200">日付</th>
                      <th className="py-2 px-4 text-left font-medium border-b border-gray-200">摘要</th>
                      <th className="py-2 px-4 text-right font-medium border-b border-gray-200">金額</th>
                      <th className="py-2 px-3 border-b border-gray-200" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const rKey = bankRecordKey(r);
                      const registered = registeredKeys.has(rKey);
                      const checked = checkedKeys.has(rKey);
                      const isDeposit = r.type === "deposit";
                      return (
                        <tr key={i} className={registered ? "bg-green-50" : checked ? "bg-blue-50" : "hover:bg-gray-50"}>
                          <td className="py-1.5 px-3 border-b border-gray-100 text-center">
                            {!registered && !isDeposit && (
                              <input type="checkbox" checked={checked} onChange={() => toggleCheck(rKey, r)}
                                className="rounded border-gray-300 cursor-pointer" />
                            )}
                          </td>
                          <td className="py-1.5 px-4 text-gray-700 border-b border-gray-100 whitespace-nowrap">{r.date}</td>
                          <td className="py-1.5 px-4 text-gray-700 border-b border-gray-100 max-w-xs truncate">{r.description}</td>
                          <td className={`py-1.5 px-4 text-right border-b border-gray-100 font-medium ${isDeposit ? "text-green-700" : "text-red-700"}`}>
                            {isDeposit ? "▲" : "▼"} {formatYen(r.amount)}
                          </td>
                          <td className="py-1.5 px-3 border-b border-gray-100 text-right whitespace-nowrap">
                            {registered ? (
                              <span className="text-xs text-green-600 font-medium">登録済み</span>
                            ) : (
                              <button
                                onClick={() => isDeposit ? setDepositTarget(r) : setRegisterTarget({ record: r, allKeys: [bankRecordKey(r)], totalAmount: r.amount })}
                                className="text-xs px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-100"
                              >
                                {isDeposit ? "入金登録" : "出金登録"}
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

          {/* フローティング一括登録バー（出金のみ） */}
          {checkedKeys.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white border border-gray-200 shadow-xl rounded-2xl px-5 py-3 flex items-center gap-4 z-40">
              <span className="text-sm text-gray-700">
                <strong>{checkedKeys.size}件</strong>（出金）選択中
                <span className="text-gray-400 ml-2">合計 {formatYen(selectedTotal)}</span>
              </span>
              <button onClick={() => setCheckedKeys(new Set())} className="text-sm text-gray-400 hover:text-gray-600">解除</button>
              <button
                onClick={() => {
                  const first = selectedRecords[0];
                  if (first) setRegisterTarget({
                    record: first,
                    allKeys: selectedRecords.map(bankRecordKey),
                    totalAmount: selectedTotal,
                  });
                }}
                className="text-sm px-4 py-2 text-white rounded-xl"
                style={{ backgroundColor: "#006a38" }}
              >
                出金を登録
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
