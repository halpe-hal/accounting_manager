"use server";

import { checkWriteAdmin } from "@/lib/auth-guard";
import { addSaleRows } from "./sales";

export async function registerIncomeFromBank(params: {
  year: number;
  month: number;
  topCategory: string;
  partner: string;
  detail: string;
  amount: number;
  taxRate: string;
}): Promise<{ success: true } | { error: string }> {
  const authErr = await checkWriteAdmin();
  if (authErr) return { error: "権限がありません" };

  const result = await addSaleRows(params.year, params.month, params.topCategory, [
    {
      partner: params.partner,
      detail: params.detail,
      expected_amount: params.amount,
      received_amount: params.amount,
      payment: "銀行振込",
      invoice_issued: false,
      tax_rate: params.taxRate,
    },
  ]);

  if ("error" in result) return { error: result.error };
  return { success: true };
}
