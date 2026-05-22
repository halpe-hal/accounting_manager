"use client";

import { useState, useTransition, useEffect } from "react";
import { upsertExpenseTarget } from "@/app/actions/settings";
import type { ExpenseTarget, Division } from "@/lib/types";
import { buildDivisionTabs } from "@/lib/division-utils";

interface Props {
  initial: ExpenseTarget[];
  divisions: Division[];
}

const FIELDS: { key: keyof Omit<ExpenseTarget, "id" | "top_category">; label: string }[] = [
  { key: "cost_rate",            label: "原価率 (%)" },
  { key: "labor_rate",           label: "人件費率 (%)" },
  { key: "fl_rate",              label: "FL比率 (%)" },
  { key: "utility_rate",         label: "水道光熱費率 (%)" },
  { key: "misc_rate",            label: "消耗品・諸経費率 (%)" },
  { key: "other_fixed_rate",     label: "その他固定費率 (%)" },
  { key: "rent_rate",            label: "家賃率 (%)" },
  { key: "flr_rate",             label: "FLR比率 (%)" },
  { key: "ad_rate",              label: "広告費率 (%)" },
  { key: "first_op_profit_rate", label: "営業利益率 (%)" },
];

export default function ExpenseTargetsTab({ initial, divisions }: Props) {
  const tabs = buildDivisionTabs(divisions);
  const [selectedKey, setSelectedKey] = useState(tabs[0]?.key ?? "");
  const [targets, setTargets] = useState<Record<string, ExpenseTarget>>(() => {
    const map: Record<string, ExpenseTarget> = {};
    for (const t of initial) map[t.top_category] = t;
    return map;
  });
  useEffect(() => {
    const map: Record<string, ExpenseTarget> = {};
    for (const t of initial) map[t.top_category] = t;
    setTargets(map);
  }, [initial]);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  const current = targets[selectedKey];
  const getValue = (key: keyof Omit<ExpenseTarget, "id" | "top_category">) =>
    current?.[key] ?? 0;

  function handleChange(key: keyof Omit<ExpenseTarget, "id" | "top_category">, value: string) {
    setTargets((prev) => ({
      ...prev,
      [selectedKey]: {
        ...(prev[selectedKey] ?? { top_category: selectedKey, id: 0 }),
        [key]: Number(value),
      },
    }));
    setSaved(false);
  }

  async function handleSave() {
    const t = targets[selectedKey];
    if (!t) return;
    setSaved(false);
    startTransition(async () => {
      const result = await upsertExpenseTarget({
        top_category: selectedKey,
        cost_rate: t.cost_rate ?? 0,
        labor_rate: t.labor_rate ?? 0,
        fl_rate: t.fl_rate ?? 0,
        utility_rate: t.utility_rate ?? 0,
        misc_rate: t.misc_rate ?? 0,
        other_fixed_rate: t.other_fixed_rate ?? 0,
        rent_rate: t.rent_rate ?? 0,
        flr_rate: t.flr_rate ?? 0,
        ad_rate: t.ad_rate ?? 0,
        first_op_profit_rate: t.first_op_profit_rate ?? 0,
      });
      if (result?.error) { setPermError(result.error); return; }
      setSaved(true);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-black mb-4">目標比率設定</h2>
      {permError && <div className="mb-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex justify-between">{permError}<button onClick={() => setPermError(null)} className="text-red-400">×</button></div>}

      {/* タブ */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setSelectedKey(tab.key); setSaved(false); }}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex flex-col items-center leading-tight ${
              selectedKey === tab.key
                ? "text-white"
                : "bg-white border border-gray-200 text-black hover:bg-gray-50"
            }`}
            style={selectedKey === tab.key ? { backgroundColor: "#006a38" } : {}}
          >
            {tab.badge && (
              <span className={`text-[10px] font-normal mb-0.5 ${selectedKey === tab.key ? "text-green-200" : "text-gray-400"}`}>
                {tab.badge}
              </span>
            )}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <input
              type="number"
              step="0.1"
              value={getValue(key)}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
          style={{ backgroundColor: "#006a38" }}
        >
          {isPending ? "保存中..." : "保存"}
        </button>
        {saved && <span className="text-sm text-green-600">保存しました</span>}
      </div>
    </div>
  );
}
