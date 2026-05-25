"use client";

import { useState, useEffect, useCallback } from "react";
import { generateTerms, getMonthsInTerm } from "@/lib/utils";
import {
  getSalesTotalsByYears,
  getSalesTotalsAll,
  getExpenseTotalsByYears,
  getExpenseTotalsAll,
  getExpenseTarget,
} from "@/app/actions/dashboard";
import type { Division, SalesTotal, ExpenseTotal, ExpenseTarget, Term } from "@/lib/types";
import { buildVirtualGroups } from "@/lib/division-utils";
import { PL_ROWS } from "@/lib/dashboard-rows";
import type { PLRow } from "@/lib/dashboard-rows";

interface Props {
  divisions: Division[];
  allDivisions?: Division[];
  taxIncluded: boolean;
  rowLimit?: PLRow;
}

type PLData = Record<string, Record<string, number>>;


function calcPL(
  salesData: SalesTotal[],
  expenseData: ExpenseTotal[],
  months: string[],
  taxIncluded: boolean
): PLData {
  const salesMap: Record<string, Record<string, number>> = {};
  for (const d of salesData) {
    const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
    if (!salesMap[key]) salesMap[key] = {};
    salesMap[key][d.tax_rate] = (salesMap[key][d.tax_rate] ?? 0) + (d.total_amount ?? 0);
  }
  const expMap: Record<string, Record<string, number>> = {};
  for (const d of expenseData) {
    const key = `${d.year}-${String(d.month).padStart(2, "0")}`;
    if (!expMap[key]) expMap[key] = {};
    expMap[key][d.second_category] = (expMap[key][d.second_category] ?? 0) + (d.total_cost ?? 0);
  }

  const rows = [
    "売上（税率10%）", "売上（税率8%）", "その他売上（税率10%）", "その他売上（税率8%）",
    "総売上", "原価", "売上総利益", "人件費", "源泉税・地方税・社会保険料",
    "水道光熱費", "消耗品費・その他諸経費", "その他固定費", "家賃", "広告費",
    "融資返済利息", "実質営業利益", "臨時諸経費", "（非課税）保険料・税金等",
    "最終営業利益", "インセンティブ支給総額", "税額計算利益",
    "消費税額", "法人税額", "融資返済元金", "内部留保",
  ];

  const pl: PLData = {};
  for (const r of rows) pl[r] = {};

  for (const ym of months) {
    const s = salesMap[ym] ?? {};
    const e = expMap[ym] ?? {};

    // DB から取得した税込の生データ（消費税額計算に使用）
    const u10 = s["売上10%"] ?? 0;
    const u8 = s["売上8%"] ?? 0;
    const o10 = s["その他売上10%"] ?? 0;
    const o8 = s["その他売上8%"] ?? 0;
    const 原価_raw = e["原価（仕入れ高）"] ?? 0;
    const 水道光熱費_raw = e["水道光熱費"] ?? 0;
    const 消耗品_raw = e["消耗品費・その他諸経費"] ?? 0;
    const その他固定費_raw = e["その他固定費"] ?? 0;
    const 家賃_raw = e["家賃"] ?? 0;
    const 広告費_raw = e["広告費"] ?? 0;
    const 臨時_raw = e["臨時諸経費"] ?? 0;

    // 税抜モードでは消費税対象の経費を割り戻す
    const 原価 = taxIncluded ? 原価_raw : 原価_raw / 1.08;
    const 人件費 = e["人件費"] ?? 0;
    const 非経費人件費 = e["源泉税・地方税・社会保険料"] ?? 0;
    const 水道光熱費 = taxIncluded ? 水道光熱費_raw : 水道光熱費_raw / 1.1;
    const 消耗品 = taxIncluded ? 消耗品_raw : 消耗品_raw / 1.1;
    const その他固定費 = taxIncluded ? その他固定費_raw : その他固定費_raw / 1.1;
    const 家賃 = taxIncluded ? 家賃_raw : 家賃_raw / 1.1;
    const 広告費 = taxIncluded ? 広告費_raw : 広告費_raw / 1.1;
    const 融資利息 = e["融資返済利息"] ?? 0;
    const 臨時 = taxIncluded ? 臨時_raw : 臨時_raw / 1.1;
    const 税金等 = e["（非課税）保険料・税金等"] ?? 0;
    const 融資元金 = e["融資返済元金"] ?? 0;
    const インセンティブ = e["インセンティブ支給総額"] ?? 0;

    let 総売上: number;
    if (taxIncluded) {
      総売上 = u10 + u8 + o10 + o8;
    } else {
      総売上 = u10 / 1.1 + u8 / 1.08 + o10 / 1.1 + o8 / 1.08;
    }
    const 売上総利益 = 総売上 - 原価;
    const 実質営業利益 = 売上総利益 - 人件費 - 水道光熱費 - 消耗品 - その他固定費 - 家賃 - 広告費 - 融資利息;
    const 最終営業利益 = 実質営業利益 - 臨時 - 税金等;
    const 税額計算利益 = 最終営業利益 - インセンティブ;

    // 消費税額は常に税込生データから計算
    const 消費税額 =
      (u10 + o10) - (u10 + o10) / 1.1 +
      (u8 + o8) - (u8 + o8) / 1.08 -
      (原価_raw - 原価_raw / 1.08) -
      ((水道光熱費_raw + 消耗品_raw + 臨時_raw + その他固定費_raw + 家賃_raw + 広告費_raw) -
       (水道光熱費_raw + 消耗品_raw + 臨時_raw + その他固定費_raw + 家賃_raw + 広告費_raw) / 1.1);
    const preLevy = 税額計算利益 - 消費税額;
    const 法人税額 = preLevy > 0 ? preLevy * 0.3358 : 0;
    const 内部留保 = 税額計算利益 - 消費税額 - 法人税額 - 融資元金;

    pl["売上（税率10%）"][ym] = taxIncluded ? u10 : u10 / 1.1;
    pl["売上（税率8%）"][ym] = taxIncluded ? u8 : u8 / 1.08;
    pl["その他売上（税率10%）"][ym] = taxIncluded ? o10 : o10 / 1.1;
    pl["その他売上（税率8%）"][ym] = taxIncluded ? o8 : o8 / 1.08;
    pl["総売上"][ym] = 総売上;
    pl["原価"][ym] = 原価;
    pl["売上総利益"][ym] = 売上総利益;
    pl["人件費"][ym] = 人件費;
    pl["源泉税・地方税・社会保険料"][ym] = 非経費人件費;
    pl["水道光熱費"][ym] = 水道光熱費;
    pl["消耗品費・その他諸経費"][ym] = 消耗品;
    pl["その他固定費"][ym] = その他固定費;
    pl["家賃"][ym] = 家賃;
    pl["広告費"][ym] = 広告費;
    pl["融資返済利息"][ym] = 融資利息;
    pl["実質営業利益"][ym] = 実質営業利益;
    pl["臨時諸経費"][ym] = 臨時;
    pl["（非課税）保険料・税金等"][ym] = 税金等;
    pl["最終営業利益"][ym] = 最終営業利益;
    pl["インセンティブ支給総額"][ym] = インセンティブ;
    pl["税額計算利益"][ym] = 税額計算利益;
    pl["消費税額"][ym] = 消費税額;
    pl["法人税額"][ym] = 法人税額;
    pl["融資返済元金"][ym] = 融資元金;
    pl["内部留保"][ym] = 内部留保;
  }

  return pl;
}

function calcTotals(pl: PLData, months: string[], taxIncluded: boolean): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const [row, vals] of Object.entries(pl)) {
    totals[row] = months.reduce((sum, m) => sum + (vals[m] ?? 0), 0);
  }
  // 合計の消費税・法人税・内部留保は再計算
  const u10t = totals["売上（税率10%）"] ?? 0;
  const u8t = totals["売上（税率8%）"] ?? 0;
  const o10t = totals["その他売上（税率10%）"] ?? 0;
  const o8t = totals["その他売上（税率8%）"] ?? 0;
  const 原価t = totals["原価"] ?? 0;
  const 水t = totals["水道光熱費"] ?? 0;
  const 消t = totals["消耗品費・その他諸経費"] ?? 0;
  const 臨t = totals["臨時諸経費"] ?? 0;
  const 固t = totals["その他固定費"] ?? 0;
  const 家t = totals["家賃"] ?? 0;
  const 広t = totals["広告費"] ?? 0;
  const 利t = totals["融資返済元金"] ?? 0;
  const inc総 = totals["インセンティブ支給総額"] ?? 0;
  const 最終 = totals["最終営業利益"] ?? 0;
  const 税額計算 = 最終 - inc総;

  // pl に格納済みの値が税込か税抜かで消費税計算式を切り替える
  let 消費税: number;
  if (taxIncluded) {
    消費税 =
      (u10t + o10t) - (u10t + o10t) / 1.1 +
      (u8t + o8t) - (u8t + o8t) / 1.08 -
      (原価t - 原価t / 1.08) -
      ((水t + 消t + 臨t + 固t + 家t + 広t) -
       (水t + 消t + 臨t + 固t + 家t + 広t) / 1.1);
  } else {
    // 税抜値から消費税額を逆算（税抜 × 税率）
    消費税 =
      (u10t + o10t) * 0.1 +
      (u8t + o8t) * 0.08 -
      原価t * 0.08 -
      (水t + 消t + 臨t + 固t + 家t + 広t) * 0.1;
  }

  const preLevy = 税額計算 - 消費税;
  const 法人税 = preLevy > 0 ? preLevy * 0.3358 : 70000;
  totals["税額計算利益"] = 税額計算;
  totals["消費税額"] = 消費税;
  totals["法人税額"] = 法人税;
  totals["内部留保"] = 税額計算 - 消費税 - 法人税 - 利t;
  return totals;
}

const RATE_ROWS: Record<string, string> = {
  "原価率": "原価",
  "人件費率": "",
  "FL比率": "",
  "水道光熱費率": "水道光熱費",
  "消耗品・その他諸経費率": "消耗品費・その他諸経費",
  "その他固定費率": "その他固定費",
  "家賃率": "家賃",
  "FLR比率": "",
  "広告費率": "広告費",
  "実質営業利益率": "実質営業利益",
  "最終営業利益率": "最終営業利益",
};

function formatYen(v: number) {
  return `¥${Math.round(v).toLocaleString("ja-JP")}`;
}
function formatPct(v: number) {
  return `${(v * 100).toFixed(1)}%`;
}

const HIGHLIGHT_ROWS = new Set([
  "総売上", "売上総利益", "実質営業利益", "最終営業利益", "内部留保",
]);
const RATE_ROW_KEYS = new Set(Object.keys(RATE_ROWS));
const PROFIT_RATE_LABELS = new Set(["実質営業利益率", "最終営業利益率"]);

export default function DashboardClient({ divisions, allDivisions, taxIncluded, rowLimit }: Props) {
  const terms = generateTerms();
  const [selectedTermIdx, setSelectedTermIdx] = useState(terms.length - 1);
  const { allOptions, virtualMap } = buildVirtualGroups(divisions, allDivisions);
  const [selectedDiv, setSelectedDiv] = useState(() => allOptions[0]?.key ?? "");
  const [plData, setPLData] = useState<PLData | null>(null);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [target, setTarget] = useState<ExpenseTarget | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedTerm: Term = terms[selectedTermIdx];
  const months = getMonthsInTerm(selectedTerm);
  const years = [...new Set(months.map((m) => Number(m.split("-")[0])))];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let salesData: SalesTotal[];
      let expData: ExpenseTotal[];

      if (selectedDiv === "Lia全体合計") {
        [salesData, expData] = await Promise.all([
          getSalesTotalsAll(years),
          getExpenseTotalsAll(years),
        ]);
      } else if (virtualMap[selectedDiv]) {
        const divList = virtualMap[selectedDiv];
        const results = await Promise.all(
          divList.map((div) =>
            Promise.all([
              getSalesTotalsByYears(years, div),
              getExpenseTotalsByYears(years, div),
            ])
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

      const pl = calcPL(salesData, expData, months, taxIncluded);
      const t = calcTotals(pl, months, taxIncluded);
      setPLData(pl);
      setTotals(t);

      // 仮想集計の場合は目標を取得しない
      if (!virtualMap[selectedDiv] && selectedDiv !== "Lia全体合計") {
        const tgt = await getExpenseTarget(selectedDiv);
        setTarget(tgt);
      } else {
        setTarget(null);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDiv, selectedTermIdx, taxIncluded]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!plData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">読み込み中...</div>
      </div>
    );
  }

  const getRate = (numerator: number, total: number) =>
    total ? numerator / total : 0;
  const totalRevenue = totals["総売上"] ?? 0;

  const targetMap: Record<string, number> = target
    ? {
        "原価率": target.cost_rate,
        "人件費率": target.labor_rate,
        "FL比率": target.fl_rate,
        "水道光熱費率": target.utility_rate,
        "消耗品・その他諸経費率": target.misc_rate,
        "その他固定費率": target.other_fixed_rate,
        "家賃率": target.rent_rate,
        "FLR比率": target.flr_rate,
        "広告費率": target.ad_rate,
        "実質営業利益率": target.first_op_profit_rate,
        "最終営業利益率": target.first_op_profit_rate,
      }
    : {};

  const HIDDEN_EXCL_TAX = new Set(["消費税額", "法人税額", "融資返済元金", "内部留保"]);
  const limitIdx = rowLimit ? PL_ROWS.indexOf(rowLimit) : PL_ROWS.length - 1;
  const PLRows = Object.keys(plData).filter((r) => {
    if (!taxIncluded && HIDDEN_EXCL_TAX.has(r)) return false;
    return PL_ROWS.indexOf(r as PLRow) <= limitIdx;
  });

  const renderRows = () => {
    const elements: React.ReactNode[] = [];

    const insertRateAfter: Record<string, string> = {
      "原価": "原価率",
      "源泉税・地方税・社会保険料": "人件費率",
      "人件費率": "FL比率",
      "水道光熱費": "水道光熱費率",
      "消耗品費・その他諸経費": "消耗品・その他諸経費率",
      "その他固定費": "その他固定費率",
      "家賃": "家賃率",
      "家賃率": "FLR比率",
      "広告費": "広告費率",
      "実質営業利益": "実質営業利益率",
      "最終営業利益": "最終営業利益率",
    };

    for (const row of PLRows) {
      const isHighlight = HIGHLIGHT_ROWS.has(row);
      const rowRevenue = plData["総売上"] ?? {};
      const stickyBg = isHighlight ? "bg-green-50" : "bg-white";
      elements.push(
        <tr
          key={row}
          className={isHighlight ? "font-bold bg-green-50" : "hover:bg-gray-50"}
        >
          <td className={`py-1.5 px-3 text-sm text-black whitespace-nowrap border border-gray-200 sticky left-0 ${stickyBg} z-10`}>
            {row}
          </td>
          <td className={`py-1.5 px-3 text-sm text-right border border-gray-200 font-medium ${(totals[row] ?? 0) < 0 ? "text-red-600" : "text-black"}`}>
            {formatYen(totals[row] ?? 0)}
          </td>
          {months.map((m) => {
            const val = plData[row]?.[m] ?? 0;
            return (
              <td key={m} className={`py-1.5 px-3 text-sm text-right border border-gray-200 ${val < 0 ? "text-red-600" : "text-black"}`}>
                {formatYen(val)}
              </td>
            );
          })}
        </tr>
      );

      const rateLabel = insertRateAfter[row];
      if (rateLabel) {
        const rateTotal = (() => {
          if (rateLabel === "人件費率")
            return getRate((totals["人件費"] ?? 0) + (totals["源泉税・地方税・社会保険料"] ?? 0), totalRevenue);
          if (rateLabel === "FL比率")
            return getRate((totals["原価"] ?? 0) + (totals["人件費"] ?? 0) + (totals["源泉税・地方税・社会保険料"] ?? 0), totalRevenue);
          if (rateLabel === "FLR比率")
            return getRate((totals["原価"] ?? 0) + (totals["人件費"] ?? 0) + (totals["源泉税・地方税・社会保険料"] ?? 0) + (totals["家賃"] ?? 0), totalRevenue);
          const numRow = RATE_ROWS[rateLabel];
          return getRate(totals[numRow] ?? 0, totalRevenue);
        })();

        const tgtRate = targetMap[rateLabel];
        const totalDiff = (rateTotal * 100) - (tgtRate ?? 0);
        const isUnderperformingTotal = tgtRate != null && tgtRate > 0
          ? (PROFIT_RATE_LABELS.has(rateLabel) ? totalDiff < 0 : totalDiff > 0)
          : false;

        elements.push(
          <tr key={rateLabel} className="bg-red-50 text-black">
            <td className="py-2 px-3 text-sm font-bold border border-gray-200 sticky left-0 bg-red-50 z-10 pl-6">
              {rateLabel}
            </td>
            <td className={`py-2 px-3 text-sm text-right border border-gray-200${isUnderperformingTotal ? " text-red-600 font-bold" : ""}`}>
              {formatPct(rateTotal)}
              {tgtRate != null && tgtRate > 0 && (
                <span className="ml-1">
                  ({totalDiff >= 0 ? "+" : ""}
                  {totalDiff.toFixed(1)}%)
                </span>
              )}
            </td>
            {months.map((m) => {
              const rev = rowRevenue[m] ?? 0;
              const num = (() => {
                if (rateLabel === "人件費率")
                  return (plData["人件費"]?.[m] ?? 0) + (plData["源泉税・地方税・社会保険料"]?.[m] ?? 0);
                if (rateLabel === "FL比率")
                  return (plData["原価"]?.[m] ?? 0) + (plData["人件費"]?.[m] ?? 0) + (plData["源泉税・地方税・社会保険料"]?.[m] ?? 0);
                if (rateLabel === "FLR比率")
                  return (plData["原価"]?.[m] ?? 0) + (plData["人件費"]?.[m] ?? 0) + (plData["源泉税・地方税・社会保険料"]?.[m] ?? 0) + (plData["家賃"]?.[m] ?? 0);
                const numRow = RATE_ROWS[rateLabel];
                return plData[numRow]?.[m] ?? 0;
              })();
              const rate = rev ? num / rev : 0;
              const monthDiff = (rate * 100) - (tgtRate ?? 0);
              const isUnderperforming = tgtRate != null && tgtRate > 0
                ? (PROFIT_RATE_LABELS.has(rateLabel) ? monthDiff < 0 : monthDiff > 0)
                : false;
              return (
                <td key={m} className={`py-2 px-3 text-sm text-right border border-gray-200${isUnderperforming ? " text-red-600 font-bold" : ""}`}>
                  {formatPct(rate)}
                  {tgtRate != null && tgtRate > 0 && (
                    <span className="ml-1">
                      ({monthDiff >= 0 ? "+" : ""}
                      {monthDiff.toFixed(1)}%)
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        );
      }
    }
    return elements;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-black mb-6">
        {taxIncluded ? "ダッシュボード" : "【税抜】ダッシュボード"}
      </h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs text-black mb-1">期を選択</label>
          <select
            value={selectedTermIdx}
            onChange={(e) => setSelectedTermIdx(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#006a38" } as React.CSSProperties}
          >
            {terms.map((t, i) => (
              <option key={t.value} value={i}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-black mb-1">事業部・店舗を選択</label>
          <select
            value={selectedDiv}
            onChange={(e) => setSelectedDiv(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": "#006a38" } as React.CSSProperties}
          >
            {allOptions.map((opt) => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-gray-400 mb-4">データを読み込み中...</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <h2 className="text-base font-semibold text-black px-4 py-3 border-b border-gray-100">
          月別PL
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ backgroundColor: "#006a38" }}>
                <th className="py-2 px-3 text-left font-bold text-white border border-gray-200 sticky left-0 z-10 min-w-48" style={{ backgroundColor: "#006a38" }}>
                  項目
                </th>
                <th className="py-2 px-3 text-right font-bold text-white border border-gray-200 min-w-28">
                  合計
                </th>
                {months.map((m) => (
                  <th
                    key={m}
                    className="py-2 px-3 text-right font-bold text-white border border-gray-200 min-w-28"
                  >
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{renderRows()}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
