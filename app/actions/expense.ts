"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";
import type { Expense } from "@/lib/types";

export async function getExpenses(
  year: number,
  month: number,
  topCategory: string
): Promise<Expense[]> {
  const supabase = await createClient();
  const batchSize = 1000;
  const all: Expense[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("all_expense")
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
  const supabase = await createClient();
  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  const secondCategory = formData.get("second_category") as string;
  const topCategory = formData.get("top_category") as string;

  await supabase.from("all_expense").insert({
    year, month,
    partner: formData.get("partner") as string,
    account: formData.get("account") as string,
    detail: formData.get("detail") as string,
    payment: formData.get("payment") as string,
    cost: Number(formData.get("cost")),
    second_category: secondCategory,
    top_category: topCategory,
    updated_at: new Date().toISOString(),
  });
  await syncCategory(year, month, secondCategory, topCategory);
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
  const supabase = await createClient();
  await supabase.from("all_expense").delete().eq("id", id);
  await syncCategory(year, month, secondCategory, topCategory);
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
  const supabase = await createClient();
  await supabase.from("all_expense").insert(
    rows.map((r) => ({
      year, month, top_category: topCategory, second_category: secondCategory,
      partner: r.partner, account: r.account, detail: r.detail,
      payment: r.payment, cost: r.cost,
      updated_at: new Date().toISOString(),
    }))
  );
  await syncCategory(year, month, secondCategory, topCategory);
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
  const supabase = await createClient();
  for (const id of deleteIds) {
    await supabase.from("all_expense").delete().eq("id", id);
  }
  for (const u of updates) {
    await supabase.from("all_expense").update({
      partner: u.partner, account: u.account, detail: u.detail,
      payment: u.payment, cost: u.cost,
      updated_at: new Date().toISOString(),
    }).eq("id", u.id);
  }
  await syncCategory(year, month, secondCategory, topCategory);
  revalidatePath("/monthly-io");
}

export async function applyFixedExpenses(
  year: number,
  month: number,
  topCategory: string
): Promise<{ error: string } | { count: number }> {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
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

  // from_fixed カラムが存在する場合は true で挿入、なければ通常挿入
  const { error: insertErr } = await supabase.from("all_expense").insert(
    baseInserts.map((r) => ({ ...r, from_fixed: true }))
  );
  if (insertErr) {
    await supabase.from("all_expense").insert(baseInserts);
  }

  const affectedCategories = [...new Set(fixedItems.map((i) => i.second_category as string))];
  for (const cat of affectedCategories) {
    await syncCategory(year, month, cat, topCategory);
  }

  revalidatePath("/monthly-io");
  return { count: fixedItems.length };
}

// all_expense の内容を depreciation テーブルへ全量同期し、total も両方更新する
async function syncCategory(
  year: number,
  month: number,
  secondCategory: string,
  topCategory: string
) {
  const supabase = await createClient();

  // 最新の all_expense を取得
  const { data: rows } = await supabase
    .from("all_expense")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("second_category", secondCategory)
    .eq("top_category", topCategory);

  // all_expense_depreciation を delete → re-insert で完全同期
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

  // 合計テーブルを両方更新
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
