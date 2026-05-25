"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";
import type {
  Division,
  ExpenseCategory,
  IncomeSource,
  DefaultPartner,
  AccountItem,
  FixedCategory,
  ExpenseTarget,
} from "@/lib/types";

// ---- 事業部 ----
export async function getDivisionsForSettings(): Promise<Division[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("divisions").select("*").order("sort_order");
  return data ?? [];
}

export async function addDivision(name: string, type?: string, brand?: string, tag?: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("divisions")
    .select("id")
    .eq("name", name)
    .maybeSingle();
  if (existing) return "duplicate";

  const { data: last } = await supabase
    .from("divisions")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (last?.sort_order ?? -1) + 1;

  await supabase.from("divisions").insert({
    name,
    type: type ?? null,
    brand: brand ?? null,
    tag: tag ?? null,
    sort_order: nextOrder,
  });
  revalidatePath("/settings");
  return "success";
}

export async function updateDivision(
  id: number,
  data: { name?: string; type?: string | null; brand?: string | null; tag?: string | null }
) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();

  if (data.name) {
    const { data: current } = await supabase
      .from("divisions").select("name").eq("id", id).maybeSingle();
    const oldName = current?.name;
    if (oldName && oldName !== data.name) {
      const newName = data.name;
      const tables = [
        "all_expense", "all_expense_depreciation",
        "all_expense_total", "all_expense_total_depreciation",
        "all_sales", "all_sales_total",
        "default_partners", "fixed_categories",
        "income_sources", "expense_targets",
      ] as const;
      const results = await Promise.all(
        tables.map((t) =>
          supabase.from(t).update({ top_category: newName }).eq("top_category", oldName)
        )
      );
      const failed = results
        .map((r, i) => r.error ? `${tables[i]}: ${r.error.message}` : null)
        .filter(Boolean);
      if (failed.length > 0) return { error: `連動更新に失敗したテーブルがあります: ${failed.join(", ")}` };
    }
  }

  await supabase.from("divisions").update(data).eq("id", id);
  revalidatePath("/settings");
}

export async function deleteDivision(id: number) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("divisions").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function updateDivisionSortOrder(id: number, direction: "up" | "down") {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  const { data: current } = await supabase.from("divisions").select("sort_order").eq("id", id).maybeSingle();
  if (!current) return;
  const { data: neighbor } = await supabase
    .from("divisions")
    .select("id, sort_order")
    .eq("sort_order", direction === "up" ? current.sort_order - 1 : current.sort_order + 1)
    .maybeSingle();
  if (!neighbor) return;
  await supabase.from("divisions").update({ sort_order: neighbor.sort_order }).eq("id", id);
  await supabase.from("divisions").update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  revalidatePath("/settings");
}

// ---- 経費カテゴリ ----
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_categories")
    .select("*")
    .order("sort_order");
  // DB column is 'second_category', not 'name' — map to match type
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.second_category ?? row.name ?? "",
    top_category: row.top_category ?? "",
    is_fixed: row.is_fixed ?? false,
    sort_order: row.sort_order ?? 0,
  }));
}

export async function addExpenseCategory(name: string, isFixed = false) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  const { data: last } = await supabase
    .from("expense_categories")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  // DB column is 'second_category'
  await supabase.from("expense_categories").insert({
    second_category: name,
    is_fixed: isFixed,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  revalidatePath("/settings");
}

export async function updateExpenseCategorySortOrder(id: number, direction: "up" | "down") {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  const { data: current } = await supabase.from("expense_categories").select("sort_order").eq("id", id).maybeSingle();
  if (!current) return;
  const { data: neighbor } = await supabase
    .from("expense_categories")
    .select("id, sort_order")
    .eq("sort_order", direction === "up" ? current.sort_order - 1 : current.sort_order + 1)
    .maybeSingle();
  if (!neighbor) return;
  await supabase.from("expense_categories").update({ sort_order: neighbor.sort_order }).eq("id", id);
  await supabase.from("expense_categories").update({ sort_order: current.sort_order }).eq("id", neighbor.id);
  revalidatePath("/settings");
}

export async function updateExpenseCategory(id: number, name: string, isFixed: boolean) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("expense_categories").update({ second_category: name, is_fixed: isFixed }).eq("id", id);
  revalidatePath("/settings");
}

export async function deleteExpenseCategory(id: number) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("expense_categories").delete().eq("id", id);
  revalidatePath("/settings");
}

// ---- 収入源 ----
export async function getIncomeSources(): Promise<IncomeSource[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("income_sources")
    .select("*")
    .order("id");
  return data ?? [];
}

export async function addIncomeSource(data: {
  partner: string;
  topCategory: string;
  taxRate: string;
  detail?: string;
  expectedAmount?: number;
  receivedAmount?: number;
  payment?: string;
}) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("income_sources").insert({
    partner: data.partner,
    top_category: data.topCategory,
    tax_rate: data.taxRate,
    detail: data.detail ?? "",
    expected_amount: data.expectedAmount ?? 0,
    received_amount: data.receivedAmount ?? 0,
    payment: data.payment ?? "",
  });
  revalidatePath("/settings");
}

export async function updateIncomeSource(
  id: number,
  data: {
    partner?: string;
    detail?: string;
    expected_amount?: number;
    received_amount?: number;
    payment?: string;
    tax_rate?: string;
  }
) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("income_sources").update(data).eq("id", id);
  revalidatePath("/settings");
}

export async function deleteIncomeSource(id: number) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("income_sources").delete().eq("id", id);
  revalidatePath("/settings");
}

// ---- デフォルト取引先 ----
export async function getDefaultPartners(): Promise<DefaultPartner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("default_partners")
    .select("*")
    .order("id");
  return data ?? [];
}

export async function addDefaultPartner(partner: Omit<DefaultPartner, "id" | "sort_order">) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("default_partners").insert({ ...partner });
  revalidatePath("/settings");
}

export async function deleteDefaultPartner(id: number) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("default_partners").delete().eq("id", id);
  revalidatePath("/settings");
}

export async function updateDefaultPartner(id: number, partner: Partial<Omit<DefaultPartner, "id" | "sort_order">>) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("default_partners").update(partner).eq("id", id);
  revalidatePath("/settings");
}

// ---- 科目 ----
export async function getAccountItems(): Promise<AccountItem[]> {
  const supabase = await createClient();
  // DB has no sort_order column — order by name
  const { data } = await supabase.from("account_items").select("id, name").order("name");
  return data ?? [];
}

export async function addAccountItem(name: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("account_items").select("id").eq("name", name).maybeSingle();
  if (existing) return "duplicate";
  await supabase.from("account_items").insert({ name });
  revalidatePath("/settings");
  return "success";
}

export async function updateAccountItem(id: number, name: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("account_items").update({ name }).eq("id", id);
  revalidatePath("/settings");
}

export async function deleteAccountItem(id: number) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("account_items").delete().eq("id", id);
  revalidatePath("/settings");
}

// ---- 固定費 ----
export async function getFixedCategories(): Promise<FixedCategory[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fixed_categories")
    .select("*")
    .order("id");
  return data ?? [];
}

export async function addFixedCategory(item: Omit<FixedCategory, "id">) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("fixed_categories").insert({
    partner: item.partner,
    account: item.account,
    detail: item.detail,
    payment: item.payment,
    cost: item.cost,
    top_category: item.top_category,
    second_category: item.second_category,
    updated_at: new Date().toISOString(),
  });
  revalidatePath("/fixed-expense");
}

export async function updateFixedCategory(
  id: number,
  item: Omit<FixedCategory, "id">
) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("fixed_categories").update({
    partner: item.partner,
    account: item.account,
    detail: item.detail,
    payment: item.payment,
    cost: item.cost,
    second_category: item.second_category,
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/fixed-expense");
}

export async function deleteFixedCategory(id: number) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("fixed_categories").delete().eq("id", id);
  revalidatePath("/fixed-expense");
}

// ---- 経費目標 ----
export async function getExpenseTargets(): Promise<ExpenseTarget[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("expense_targets").select("*");
  return data ?? [];
}

export async function upsertExpenseTarget(target: Omit<ExpenseTarget, "id">) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("expense_targets")
    .select("id")
    .eq("top_category", target.top_category)
    .maybeSingle();
  if (existing) {
    await supabase.from("expense_targets").update(target).eq("id", existing.id);
  } else {
    await supabase.from("expense_targets").insert(target);
  }
  revalidatePath("/settings");
}

// ---- 権限管理 ----
export async function getUsersWithPermissions() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_app_permissions")
    .select("*");
  return data ?? [];
}

export async function grantPermission(userId: string, appName: string) {
  const supabase = await createClient();
  await supabase
    .from("user_app_permissions")
    .upsert({ user_id: userId, app_name: appName }, { onConflict: "user_id,app_name" });
  revalidatePath("/admin");
}

export async function revokePermission(userId: string, appName: string) {
  const supabase = await createClient();
  await supabase
    .from("user_app_permissions")
    .delete()
    .eq("user_id", userId)
    .eq("app_name", appName);
  revalidatePath("/admin");
}
