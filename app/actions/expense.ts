"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";
import { isDepreciationMode } from "@/lib/depreciation-mode";
import type { Expense } from "@/lib/types";

export async function getExpenses(
  year: number,
  month: number,
  topCategory: string
): Promise<Expense[]> {
  const supabase = await createClient();
  const depMode = await isDepreciationMode();
  const table = depMode ? "all_expense_depreciation" : "all_expense";
  const batchSize = 1000;
  const all: Expense[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from(table)
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .eq("top_category", topCategory)
      .order("id")
      .range(offset, offset + batchSize - 1);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }
  return all;
}

export async function addExpense(formData: FormData) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const depMode = await isDepreciationMode();
  const supabase = await createClient();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const secondCategory = formData.get("second_category") as string;
  const topCategory = formData.get("top_category") as string;
  const row = {
    year, month,
    partner: formData.get("partner") as string,
    account: formData.get("account") as string,
    detail: formData.get("detail") as string,
    payment: formData.get("payment") as string,
    cost: Number(formData.get("cost")),
    second_category: secondCategory,
    top_category: topCategory,
    updated_at: new Date().toISOString(),
  };
  if (depMode) {
    await supabase.from("all_expense_depreciation").insert(row);
    await syncDepOnly(year, month, secondCategory, topCategory);
  } else {
    await supabase.from("all_expense").insert(row);
    await syncCategory(year, month, secondCategory, topCategory);
  }
  revalidatePath("/monthly-io");
}

export async function deleteExpense(
  id: number,
  year: number,
  month: number,
  secondCategory: string,
  topCategory: string
) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const depMode = await isDepreciationMode();
  const supabase = await createClient();
  if (depMode) {
    await supabase.from("all_expense_depreciation").delete().eq("id", id);
    await syncDepOnly(year, month, secondCategory, topCategory);
  } else {
    await supabase.from("all_expense").delete().eq("id", id);
    await syncCategory(year, month, secondCategory, topCategory);
  }
  revalidatePath("/monthly-io");
}

export async function addExpenseRows(
  year: number,
  month: number,
  topCategory: string,
  secondCategory: string,
  rows: Array<{ partner: string; account: string; detail: string; payment: string; cost: number }>
): Promise<{ error: string } | { count: number }> {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  if (rows.length === 0) return { count: 0 };
  const depMode = await isDepreciationMode();
  const supabase = await createClient();
  const inserts = rows.map((r) => ({
    year, month, top_category: topCategory, second_category: secondCategory,
    partner: r.partner, account: r.account, detail: r.detail,
    payment: r.payment, cost: r.cost,
    updated_at: new Date().toISOString(),
  }));
  if (depMode) {
    await supabase.from("all_expense_depreciation").insert(inserts);
    await syncDepOnly(year, month, secondCategory, topCategory);
  } else {
    await supabase.from("all_expense").insert(inserts);
    await syncCategory(year, month, secondCategory, topCategory);
  }
  revalidatePath("/monthly-io");
  return { count: rows.length };
}

export async function saveExpenseRows(
  year: number,
  month: number,
  topCategory: string,
  secondCategory: string,
  updates: Array<{ id: number; partner: string; account: string; detail: string; payment: string; cost: number }>,
  deleteIds: number[]
): Promise<{ error: string } | undefined> {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const depMode = await isDepreciationMode();
  const supabase = await createClient();
  const table = depMode ? "all_expense_depreciation" : "all_expense";
  for (const id of deleteIds) {
    await supabase.from(table).delete().eq("id", id);
  }
  for (const u of updates) {
    await supabase.from(table).update({
      partner: u.partner, account: u.account, detail: u.detail,
      payment: u.payment, cost: u.cost,
      updated_at: new Date().toISOString(),
    }).eq("id", u.id);
  }
  if (depMode) {
    await syncDepOnly(year, month, secondCategory, topCategory);
  } else {
    await syncCategory(year, month, secondCategory, topCategory);
  }
  revalidatePath("/monthly-io");
}

export async function applyFixedExpenses(
  year: number,
  month: number,
  topCategory: string
): Promise<{ error: string } | { count: number }> {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const depMode = await isDepreciationMode();
  const supabase = await createClient();
  const { data: fixedItems } = await supabase
    .from("fixed_categories")
    .select("*")
    .eq("top_category", topCategory);
  if (!fixedItems || fixedItems.length === 0) return { count: 0 };

  const baseInserts = fixedItems.map((item) => ({
    year, month,
    partner: item.partner ?? "",
    account: item.account ?? "",
    detail: item.detail ?? "",
    payment: item.payment ?? "",
    cost: item.cost ?? 0,
    second_category: item.second_category,
    top_category: topCategory,
    updated_at: new Date().toISOString(),
  }));

  const affectedCategories = [...new Set(fixedItems.map((i) => i.second_category as string))];

  if (depMode) {
    const { error: insertErr } = await supabase.from("all_expense_depreciation").insert(
      baseInserts.map((r) => ({ ...r, from_fixed: true }))
    );
    if (insertErr) {
      await supabase.from("all_expense_depreciation").insert(baseInserts);
    }
    for (const cat of affectedCategories) {
      await syncDepOnly(year, month, cat, topCategory);
    }
  } else {
    const { error: insertErr } = await supabase.from("all_expense").insert(
      baseInserts.map((r) => ({ ...r, from_fixed: true }))
    );
    if (insertErr) {
      await supabase.from("all_expense").insert(baseInserts);
    }
    for (const cat of affectedCategories) {
      await syncCategory(year, month, cat, topCategory);
    }
  }

  revalidatePath("/monthly-io");
  return { count: fixedItems.length };
}

// デフォルトモード: all_expense → all_expense_depreciation に同期し、両方の total を更新
async function syncCategory(
  year: number,
  month: number,
  secondCategory: string,
  topCategory: string
) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("all_expense")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("second_category", secondCategory)
    .eq("top_category", topCategory);

  await supabase
    .from("all_expense_depreciation")
    .delete()
    .eq("year", year)
    .eq("month", month)
    .eq("second_category", secondCategory)
    .eq("top_category", topCategory);

  if (rows && rows.length > 0) {
    const depInserts = rows.map((r) => ({
      year, month,
      second_category: secondCategory,
      top_category: topCategory,
      partner: r.partner,
      account: r.account,
      detail: r.detail,
      payment: r.payment,
      cost: r.cost,
      updated_at: new Date().toISOString(),
    }));
    const { error: depErr } = await supabase.from("all_expense_depreciation").insert(
      rows.map((r, i) => ({ ...depInserts[i], from_fixed: r.from_fixed ?? false }))
    );
    if (depErr) {
      await supabase.from("all_expense_depreciation").insert(depInserts);
    }
  }

  const totalCost = (rows ?? []).reduce((sum, r) => sum + (r.cost ?? 0), 0);

  await supabase
    .from("all_expense_total")
    .delete()
    .eq("year", year).eq("month", month)
    .eq("second_category", secondCategory).eq("top_category", topCategory);

  await supabase
    .from("all_expense_total_depreciation")
    .delete()
    .eq("year", year).eq("month", month)
    .eq("second_category", secondCategory).eq("top_category", topCategory);

  if (!rows || rows.length === 0) return;

  const totalRow = {
    year, month,
    second_category: secondCategory,
    top_category: topCategory,
    total_cost: totalCost,
    updated_at: new Date().toISOString(),
  };
  await Promise.all([
    supabase.from("all_expense_total").insert(totalRow),
    supabase.from("all_expense_total_depreciation").insert(totalRow),
  ]);
}

// 減価償却モード: all_expense_depreciation のみ更新し、total_depreciation だけ再計算
async function syncDepOnly(
  year: number,
  month: number,
  secondCategory: string,
  topCategory: string
) {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("all_expense_depreciation")
    .select("cost")
    .eq("year", year)
    .eq("month", month)
    .eq("second_category", secondCategory)
    .eq("top_category", topCategory);

  const totalCost = (rows ?? []).reduce((sum, r) => sum + (r.cost ?? 0), 0);

  await supabase
    .from("all_expense_total_depreciation")
    .delete()
    .eq("year", year).eq("month", month)
    .eq("second_category", secondCategory).eq("top_category", topCategory);

  if (!rows || rows.length === 0) return;

  await supabase.from("all_expense_total_depreciation").insert({
    year, month,
    second_category: secondCategory,
    top_category: topCategory,
    total_cost: totalCost,
    updated_at: new Date().toISOString(),
  });
}
