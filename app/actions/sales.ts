"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";
import type { Sale } from "@/lib/types";

export async function getSales(
  year: number,
  month: number,
  topCategory: string
): Promise<Sale[]> {
  const supabase = await createClient();
  const batchSize = 1000;
  const all: Sale[] = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase
      .from("all_sales")
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

export async function addSale(formData: FormData) {
  const authErr = await checkWriteAdmin();
  if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("all_sales").insert({
    year: Number(formData.get("year")),
    month: Number(formData.get("month")),
    partner: formData.get("partner") as string,
    detail: formData.get("detail") as string,
    expected_amount: Number(formData.get("expected_amount")),
    received_amount: Number(formData.get("received_amount")),
    payment: formData.get("payment") as string,
    top_category: formData.get("top_category") as string,
    invoice_issued: formData.get("invoice_issued") === "true",
    tax_rate: formData.get("tax_rate") as string,
    updated_at: new Date().toISOString(),
  });
  await updateSalesTotal(
    Number(formData.get("year")),
    Number(formData.get("month")),
    formData.get("top_category") as string
  );
  revalidatePath("/monthly-io");
}

export async function deleteSale(id: number, year: number, month: number, topCategory: string) {
  const authErr = await checkWriteAdmin();
  if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("all_sales").delete().eq("id", id);
  await updateSalesTotal(year, month, topCategory);
  revalidatePath("/monthly-io");
}

export async function addSaleRows(
  year: number,
  month: number,
  topCategory: string,
  rows: Array<{ partner: string; detail: string; expected_amount: number; received_amount: number; payment: string; invoice_issued: boolean; tax_rate: string }>
): Promise<{ error: string } | { count: number }> {
  const authErr = await checkWriteAdmin();
  if (authErr) return authErr;
  if (rows.length === 0) return { count: 0 };
  const supabase = await createClient();
  await supabase.from("all_sales").insert(
    rows.map((r) => ({
      year, month, top_category: topCategory,
      partner: r.partner, detail: r.detail,
      expected_amount: r.expected_amount, received_amount: r.received_amount,
      payment: r.payment, invoice_issued: r.invoice_issued, tax_rate: r.tax_rate,
      updated_at: new Date().toISOString(),
    }))
  );
  await updateSalesTotal(year, month, topCategory);
  revalidatePath("/monthly-io");
  return { count: rows.length };
}

export async function saveSaleRows(
  year: number,
  month: number,
  topCategory: string,
  updates: Array<{ id: number; partner: string; detail: string; expected_amount: number; received_amount: number; payment: string; invoice_issued: boolean; tax_rate: string }>,
  deleteIds: number[]
): Promise<{ error: string } | undefined> {
  const authErr = await checkWriteAdmin();
  if (authErr) return authErr;
  const supabase = await createClient();
  for (const id of deleteIds) {
    await supabase.from("all_sales").delete().eq("id", id);
  }
  for (const u of updates) {
    await supabase.from("all_sales").update({
      partner: u.partner, detail: u.detail,
      expected_amount: u.expected_amount, received_amount: u.received_amount,
      payment: u.payment, invoice_issued: u.invoice_issued, tax_rate: u.tax_rate,
      updated_at: new Date().toISOString(),
    }).eq("id", u.id);
  }
  await updateSalesTotal(year, month, topCategory);
  revalidatePath("/monthly-io");
}

async function updateSalesTotal(year: number, month: number, topCategory: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("all_sales")
    .select("*")
    .eq("year", year)
    .eq("month", month)
    .eq("top_category", topCategory);

  const totals: Record<string, number> = {};
  for (const row of data ?? []) {
    totals[row.tax_rate] = (totals[row.tax_rate] ?? 0) + (row.received_amount ?? 0);
  }

  await supabase
    .from("all_sales_total")
    .delete()
    .eq("year", year)
    .eq("month", month)
    .eq("top_category", topCategory);

  for (const [taxRate, totalAmount] of Object.entries(totals)) {
    await supabase.from("all_sales_total").insert({
      year,
      month,
      top_category: topCategory,
      tax_rate: taxRate,
      total_amount: totalAmount,
      updated_at: new Date().toISOString(),
    });
  }
}
