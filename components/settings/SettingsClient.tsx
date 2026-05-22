"use client";

import { useState } from "react";
import type {
  Division,
  ExpenseCategory,
  IncomeSource,
  DefaultPartner,
  AccountItem,
  ExpenseTarget,
} from "@/lib/types";
import DivisionsTab from "./DivisionsTab";
import ExpenseCategoriesTab from "./ExpenseCategoriesTab";
import IncomeSourcesTab from "./IncomeSourcesTab";
import AccountItemsTab from "./AccountItemsTab";
import ExpenseTargetsTab from "./ExpenseTargetsTab";
import DefaultPartnersTab from "./DefaultPartnersTab";

type Tab = "divisions" | "expense-categories" | "income-sources" | "account-items" | "expense-targets" | "default-partners";

const TABS: { key: Tab; label: string }[] = [
  { key: "divisions", label: "事業部・店舗設定" },
  { key: "account-items", label: "勘定科目設定" },
  { key: "expense-categories", label: "費目設定" },
  { key: "expense-targets", label: "目標比率設定" },
  { key: "default-partners", label: "取引先デフォルト設定" },
  { key: "income-sources", label: "入金元デフォルト設定" },
];

interface Props {
  divisions: Division[];
  expenseCategories: ExpenseCategory[];
  incomeSources: IncomeSource[];
  defaultPartners: DefaultPartner[];
  accountItems: AccountItem[];
  expenseTargets: ExpenseTarget[];
}

export default function SettingsClient({
  divisions,
  expenseCategories,
  incomeSources,
  defaultPartners,
  accountItems,
  expenseTargets,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("divisions");

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">設定</h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === t.key
                ? "text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
            style={activeTab === t.key ? { backgroundColor: "#006a38" } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "divisions" && <DivisionsTab initial={divisions} />}
      {activeTab === "expense-categories" && (
        <ExpenseCategoriesTab initial={expenseCategories} />
      )}
      {activeTab === "income-sources" && (
        <IncomeSourcesTab initial={incomeSources} divisions={divisions} />
      )}
      {activeTab === "account-items" && <AccountItemsTab initial={accountItems} />}
      {activeTab === "expense-targets" && (
        <ExpenseTargetsTab initial={expenseTargets} divisions={divisions} />
      )}
      {activeTab === "default-partners" && (
        <DefaultPartnersTab
          divisions={divisions}
          expenseCategories={expenseCategories}
          accountItems={accountItems}
          initial={defaultPartners}
        />
      )}
    </div>
  );
}
