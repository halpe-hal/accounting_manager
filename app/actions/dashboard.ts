"use server";

import { createClient } from "@/lib/supabase/server";
import { ADMIN_EMAILS } from "@/lib/page-permissions";
import type { Division, SalesTotal, ExpenseTotal, ExpenseTarget } from "@/lib/types";

export async function getDivisions(): Promise<Division[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 管理者は全事業部を返す
  if (ADMIN_EMAILS.includes(user.email ?? "")) {
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");
    return data ?? [];
  }

  // 一般ユーザーは許可された事業部のみ
  const { data: access } = await supabase
    .from("user_division_access")
    .select("division_name")
    .eq("user_id", user.id);

  const allowedNames = (access ?? []).map((r: { division_name: string }) => r.division_name);
  if (allowedNames.length === 0) return [];

  const { data } = await supabase
    .from("divisions")
    .select("*")
    .in("name", allowedNames)
    .order("sort_order");
  return data ?? [];
}

// 全事業部を返す（集計判定用）
async function getAllDivisionsRaw(): Promise<Division[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("divisions").select("*").order("sort_order");
  return data ?? [];
}

// 管理者モード: allDivisions=undefined、一般ユーザーモード: allDivisions=全事業部リスト
export async function getDivisionsContext(): Promise<{
  divisions: Division[];
  allDivisions?: Division[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { divisions: [] };

  if (ADMIN_EMAILS.includes(user.email ?? "")) {
    const { data } = await supabase.from("divisions").select("*").order("sort_order");
    return { divisions: data ?? [] };
  }

  const [allDivisions, userDivisions] = await Promise.all([
    getAllDivisionsRaw(),
    getDivisions(),
  ]);
  return { divisions: userDivisions, allDivisions };
}

export async function getSalesTotalsByYears(
  years: number[],
  topCategory: string
): Promise<SalesTotal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("all_sales_total")
    .select("*")
    .in("year", years)
    .eq("top_category", topCategory);
  return data ?? [];
}

export async function getSalesTotalsAll(years: number[]): Promise<SalesTotal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("all_sales_total")
    .select("*")
    .in("year", years);
  return data ?? [];
}

export async function getExpenseTotalsByYears(
  years: number[],
  topCategory: string
): Promise<ExpenseTotal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("all_expense_total")
    .select("*")
    .in("year", years)
    .eq("top_category", topCategory);
  return data ?? [];
}

export async function getExpenseTotalsAll(years: number[]): Promise<ExpenseTotal[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("all_expense_total")
    .select("*")
    .in("year", years);
  return data ?? [];
}

export async function getExpenseTarget(
  topCategory: string
): Promise<ExpenseTarget | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_targets")
    .select("*")
    .eq("top_category", topCategory)
    .maybeSingle();
  return data ?? null;
}
