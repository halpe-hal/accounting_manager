"use client";

import { useState, useEffect, useCallback } from "react";
import { getSales } from "@/app/actions/sales";
import { getExpenses } from "@/app/actions/expense";
import type {
  Division,
  Sale,
  Expense,
  ExpenseCategory,
  IncomeSource,
  DefaultPartner,
  AccountItem,
  FixedCategory,
} from "@/lib/types";
import { sortDivisionsByBrand, divisionDisplayName } from "@/lib/division-utils";
import SalesTable from "./SalesTable";
import ExpenseTable from "./ExpenseTable";

interface Props {
  divisions: Division[];
  expenseCategories: ExpenseCategory[];
  incomeSources: IncomeSource[];
  defaultPartners: DefaultPartner[];
  accountItems: AccountItem[];
  fixedCategories: FixedCategory[];
}

export default function MonthlyIOClient({
  divisions,
  expenseCategories,
  incomeSources,
  defaultPartners,
  accountItems,
  fixedCategories,
}: Props) {
  const sortedDivs = sortDivisionsByBrand(divisions);
  const now = new Date();
  const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const [year, setYear] = useState(prevYear);
  const [month, setMonth] = useState(prevMonth);
  const [selectedDiv, setSelectedDiv] = useState(sortedDivs[0]?.name ?? "");
  const [activeTab, setActiveTab] = useState<"sales" | "expense">("sales");
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [expenseTableKey, setExpenseTableKey] = useState(0);

  const years = Array.from({ length: 10 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const loadData = useCallback(async () => {
    if (!selectedDiv) return;
    setLoading(true);
    const [s, e] = await Promise.all([
      getSales(year, month, selectedDiv),
      getExpenses(year, month, selectedDiv),
    ]);
    setSales(s);
    setExpenses(e);
    setExpenseTableKey((k) => k + 1);
    setLoading(false);
  }, [year, month, selectedDiv]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">月別入出金管理</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-xs text-gray-500 mb-1">年</label>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            {years.map((y) => <option key={y} value={y}>{y}年</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">月</label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none"
          >
            {months.map((m) => <option key={m} value={m}>{m}月</option>)}
          </select>
        </div>
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

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("sales")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "sales"
              ? "text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
          style={activeTab === "sales" ? { backgroundColor: "#006a38" } : {}}
        >
          入金明細
        </button>
        <button
          onClick={() => setActiveTab("expense")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "expense"
              ? "text-white"
              : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
          style={activeTab === "expense" ? { backgroundColor: "#006a38" } : {}}
        >
          出金明細
        </button>
      </div>

      <div className={loading ? "opacity-60 pointer-events-none" : ""}>
        {activeTab === "sales" ? (
          <SalesTable
            sales={sales}
            year={year}
            month={month}
            topCategory={selectedDiv}
            incomeSources={incomeSources.filter((s) => s.top_category === selectedDiv)}
            onRefresh={loadData}
          />
        ) : (
          <ExpenseTable
            key={expenseTableKey}
            expenses={expenses}
            year={year}
            month={month}
            topCategory={selectedDiv}
            expenseCategories={expenseCategories}
            defaultPartners={defaultPartners.filter((p) => p.top_category === selectedDiv)}
            accountItems={accountItems}
            fixedCategories={fixedCategories.filter((f) => f.top_category === selectedDiv)}
            onRefresh={loadData}
          />
        )}
      </div>
    </div>
  );
}
