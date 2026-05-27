"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";
import type { SocialInsuranceEmployee, SocialInsuranceRates } from "@/lib/types";

const TABLE = "social_insurance_employees";
const RATES_TABLE = "social_insurance_rates";
const REFLECTIONS_TABLE = "social_insurance_reflections";

export async function getReflections(): Promise<Array<{ year: number; month: number }>> {
  const supabase = await createClient();
  const { data } = await supabase.from(REFLECTIONS_TABLE).select("year, month");
  return data ?? [];
}

export async function getRates(): Promise<SocialInsuranceRates> {
  const supabase = await createClient();
  const { data } = await supabase.from(RATES_TABLE).select("*").eq("id", 1).maybeSingle();
  return data ?? { health_insurance_rate: 0, child_support_rate: 0, pension_rate: 0, child_contribution_rate: 0 };
}

export async function updateRates(rates: Omit<SocialInsuranceRates, "updated_at">): Promise<{ error: string } | undefined> {
  const authErr = await checkWriteAdmin(); if (authErr) return { error: "権限がありません" };
  const supabase = await createClient();
  const { error } = await supabase
    .from(RATES_TABLE)
    .upsert({ id: 1, ...rates, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/social-insurance");
}

export async function getEmployees(): Promise<SocialInsuranceEmployee[]> {
  const supabase = await createClient();
  const { data } = await supabase.from(TABLE).select("*").order("sort_order").order("id");
  return data ?? [];
}

export async function addEmployee(
  name: string,
  standardMonthlyRemuneration: number,
  division: string,
  enrollmentYear: number | null,
  enrollmentMonth: number | null
): Promise<{ error: string } | { id: number }> {
  const authErr = await checkWriteAdmin(); if (authErr) return { error: "権限がありません" };
  const supabase = await createClient();
  const { data: last } = await supabase
    .from(TABLE)
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name,
      standard_monthly_remuneration: standardMonthlyRemuneration,
      division,
      enrollment_year: enrollmentYear,
      enrollment_month: enrollmentMonth,
      sort_order: (last?.sort_order ?? -1) + 1,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/social-insurance");
  return { id: data.id };
}

export async function updateEmployee(
  id: number,
  name: string,
  standardMonthlyRemuneration: number,
  division: string,
  enrollmentYear: number | null,
  enrollmentMonth: number | null
): Promise<{ error: string } | undefined> {
  const authErr = await checkWriteAdmin(); if (authErr) return { error: "権限がありません" };
  const supabase = await createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({
      name,
      standard_monthly_remuneration: standardMonthlyRemuneration,
      division,
      enrollment_year: enrollmentYear,
      enrollment_month: enrollmentMonth,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/social-insurance");
}

export async function deleteEmployee(id: number): Promise<{ error: string } | undefined> {
  const authErr = await checkWriteAdmin(); if (authErr) return { error: "権限がありません" };
  const supabase = await createClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/social-insurance");
}
