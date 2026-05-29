"use server";

import { createClient } from "@/lib/supabase/server";
import { isDepreciationMode } from "@/lib/depreciation-mode";
import { getExpenseCategories, getFixedCategories } from "@/app/actions/settings";
import type { Division, AccountItem, ExpenseCategory, Expense, FixedCategory } from "@/lib/types";

export type RegistrationFormData = {
  divisions: Division[];
  categories: ExpenseCategory[];
  accounts: AccountItem[];
  fixedCategories: FixedCategory[];
};

export async function getRegistrationFormData(): Promise<RegistrationFormData> {
  const supabase = await createClient();
  const [categories, fixedCategories, { data: divisions }, { data: accounts }] = await Promise.all([
    getExpenseCategories(),
    getFixedCategories(),
    supabase.from("divisions").select("*").order("sort_order"),
    supabase.from("account_items").select("id, name").order("name"),
  ]);
  return {
    divisions: divisions ?? [],
    categories,
    accounts: (accounts ?? []) as AccountItem[],
    fixedCategories,
  };
}

export async function findExistingExpense(
  year: number,
  month: number,
  topCategory: string,
  secondCategory: string,
  partner: string
): Promise<Expense | null> {
  if (!topCategory || !secondCategory || !partner) return null;
  const supabase = await createClient();
  const depMode = await isDepreciationMode();
  const table = depMode ? "all_expense_depreciation" : "all_expense";
  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("top_category", topCategory)
    .eq("second_category", secondCategory)
    .eq("partner", partner)
    .limit(1)
    .maybeSingle();
  return data ?? null;
}
