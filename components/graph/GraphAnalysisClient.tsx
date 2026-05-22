"use client";

import { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { generateTerms, getMonthsInTerm } from "@/lib/utils";
import { buildVirtualGroups } from "@/lib/division-utils";
import {
  getSalesTotalsByYears,
  getSalesTotalsAll,
  getExpenseTotalsByYears,
  getExpenseTotalsAll,
} from "@/app/actions/dashboard";
import type { Division, SalesTotal, ExpenseTotal, ExpenseCategory, ExpenseTarget, Term } from "@/lib/types";

interface Props {
  divisions: Division[];
  allDivisions?: Division[];
  expenseCategories: ExpenseCategory[];
  expenseTargets: ExpenseTarget[];
}

const CATEGORY_TO_TARGET_KEY: Record<string, keyof ExpenseTarget> = {
  "原価（仕入れ高）": "cost_rate",
  "人件費": "labor_rate",
  "源泉税・地方税・社会保険料": "labor_rate",
  "水道光熱費": "utility_rate",
  "消耗品費・その他諸経費": "misc_rate",
  "その他固定費": "other_fixed_rate",
  "家賃": "rent_rate",
  "広告費": "ad_rate",
};


const formatYen = (v: number) =>
  v >= 1000000
    ? `¥${(v / 1000000).toFixed(1)}M`
    : `¥${Math.round(v / 1000)}K`;

export default function GraphAnalysisClient({ divisions, allDivisions, expenseCategories, expenseTargets }: Props) {
  const terms = generateTerms();
  const [selectedTermIdx, setSelectedTermIdx] = useState(terms.length - 1);
  const [chartData, setChartData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const { allOptions, virtualMap } = buildVirtualGroups(divisions, allDivisions);
  const [selectedDiv, setSelectedDiv] = useState(() => allOptions[0]?.key ?? "");
  const selectedTerm: Term = terms[selectedTermIdx];
  const months = getMonthsInTerm(selectedTerm);
  const years = [...new Set(months.map((m) => Number(m.split("-")[0])))];

  const target = expenseTargets.find((t) => t.top_category === selectedDiv) ?? null;

  const uniqueCategories = Array.from(
    new Map(expenseCategories.map((c) => [c.name, c])).values()
  ).sort((a, b) => a.sort_order - b.sort_order);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let salesData: SalesTotal[];
      let expData: ExpenseTotal[];

      if (selectedDiv === "Lia全体合計") {
        [salesData, expData] = await Promise.all([getSalesTotalsAll(years), getExpenseTotalsAll(years)]);
      } else if (virtualMap[selectedDiv]) {
        const divList = virtualMap[selectedDiv];
        const results = await Promise.all(
          divList.map((div) =>
            Promise.all([getSalesTotalsByYears(years, div), getExpenseTotalsByYears(years, div)])
          )
        );
        salesData = results.flatMap(([s]) => s);
        expData = results.flatMap(([, e]) => e);
      } else {
        [salesData, expData] = await Promise.all([
          getSalesTotalsByYears(years, selectedDiv),
          getExpenseTotalsByYears(years, selectedDiv),
        ]);
      }

      const salesMap: Record<string, number> = {};
      for (const d of salesData) {
        const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
        salesMap[key] = (salesMap[key] ?? 0) + (d.total_amount ?? 0);
      }
      const expMap: Record<string, Record<string, number>> = {};
      for (const d of expData) {
        const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
        if (!expMap[key]) expMap[key] = {};
        expMap[key][d.second_category] = (expMap[key][d.second_category] ?? 0) + (d.total_cost ?? 0);
      }

      const data = months.map((m) => {
        const e = expMap[m] ?? {};
        const row: Record<string, unknown> = { month: m, 総売上: salesMap[m] ?? 0 };
        for (const cat of uniqueCategories) {
          row[cat.name] = e[cat.name] ?? 0;
        }
        return row;
      });

      setChartData(data);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiv, selectedTermIdx]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-6">グラフ分析</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs text-black mb-1">期を選択</label>
          <select
            value={selectedTermIdx}
            onChange={(e) => setSelectedTermIdx(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            {terms.map((t, i) => (
              <option key={t.value} value={i}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-black mb-1">事業部・店舗を選択</label>
          <select
            value={selectedDiv}
            onChange={(e) => setSelectedDiv(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            {allOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-black py-8 text-center">データを読み込み中...</div>
      ) : (
        <div className="space-y-6">
          {/* 売上推移 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-black mb-4">売上推移</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatYen} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => typeof v === "number" ? `¥${Math.round(v).toLocaleString()}` : v} />
                <Bar dataKey="総売上" fill="#006a38" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 費目別支出推移 */}
          {uniqueCategories.map((cat) => {
            const targetKey = CATEGORY_TO_TARGET_KEY[cat.name];
            const targetRate = targetKey && target ? (target[targetKey] as number) : null;

            return (
              <div key={cat.name} className="bg-white rounded-2xl border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-black mb-4">{cat.name}</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={formatYen} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v, name) => {
                        if (typeof v !== "number") return v;
                        if (name === "目標") return `¥${Math.round(v).toLocaleString()}`;
                        return `¥${Math.round(v).toLocaleString()}`;
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey={cat.name}
                      stroke="#006a38"
                      dot={false}
                      strokeWidth={2}
                    />
                    {targetRate != null && targetRate > 0 && (
                      <Line
                        type="monotone"
                        dataKey={(entry: Record<string, unknown>) => {
                          const sales = entry["総売上"] as number ?? 0;
                          return Math.round(sales * (targetRate / 100));
                        }}
                        name="目標"
                        stroke="#dc2626"
                        strokeDasharray="6 3"
                        dot={false}
                        strokeWidth={1.5}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
