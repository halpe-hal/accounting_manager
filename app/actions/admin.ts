"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";
import { ADMIN_EMAILS } from "@/lib/page-permissions";

export type AdminUser = {
  user_id: string;
  email: string;
  is_admin: boolean;
};

export async function getAdminUsers(): Promise<AdminUser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email")
    .order("email");
  return (data ?? []).map((row) => ({
    user_id: row.id,
    email: row.email,
    is_admin: ADMIN_EMAILS.includes(row.email),
  }));
}

export async function getUserPagePermissions(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_app_permissions")
    .select("user_id, app_name");
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!result[row.user_id]) result[row.user_id] = [];
    result[row.user_id].push(row.app_name);
  }
  return result;
}

export async function getUserDivisionAccess(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_division_access")
    .select("user_id, division_name");
  const result: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!result[row.user_id]) result[row.user_id] = [];
    result[row.user_id].push(row.division_name);
  }
  return result;
}

export async function grantPagePermission(userId: string, appName: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase
    .from("user_app_permissions")
    .upsert({ user_id: userId, app_name: appName }, { onConflict: "user_id,app_name" });
  revalidatePath("/admin");
}

export async function revokePagePermission(userId: string, appName: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase
    .from("user_app_permissions")
    .delete()
    .eq("user_id", userId)
    .eq("app_name", appName);
  revalidatePath("/admin");
}

export async function grantAllPagePermissions(userId: string, appNames: string[]) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("user_app_permissions").upsert(
    appNames.map((app_name) => ({ user_id: userId, app_name })),
    { onConflict: "user_id,app_name" }
  );
  revalidatePath("/admin");
}

export async function revokeAllPagePermissions(userId: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase
    .from("user_app_permissions")
    .delete()
    .eq("user_id", userId);
  revalidatePath("/admin");
}

export async function grantDivisionAccess(userId: string, divisionName: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase
    .from("user_division_access")
    .upsert({ user_id: userId, division_name: divisionName }, { onConflict: "user_id,division_name" });
  revalidatePath("/admin/divisions");
}

export async function revokeDivisionAccess(userId: string, divisionName: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase
    .from("user_division_access")
    .delete()
    .eq("user_id", userId)
    .eq("division_name", divisionName);
  revalidatePath("/admin/divisions");
}

export async function grantAllDivisionAccess(userId: string, divisionNames: string[]) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase.from("user_division_access").upsert(
    divisionNames.map((division_name) => ({ user_id: userId, division_name })),
    { onConflict: "user_id,division_name" }
  );
  revalidatePath("/admin/divisions");
}

export async function revokeAllDivisionAccess(userId: string) {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  await supabase
    .from("user_division_access")
    .delete()
    .eq("user_id", userId);
  revalidatePath("/admin/divisions");
}

export async function getDashboardRowLimits(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_dashboard_row_limit").select("user_id, max_row");
  const result: Record<string, string> = {};
  for (const row of data ?? []) result[row.user_id] = row.max_row;
  return result;
}

export async function setDashboardRowLimit(
  userId: string,
  maxRow: string | null
): Promise<{ error: string } | undefined> {
  const authErr = await checkWriteAdmin(); if (authErr) return authErr;
  const supabase = await createClient();
  if (!maxRow) {
    const { error } = await supabase.from("user_dashboard_row_limit").delete().eq("user_id", userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("user_dashboard_row_limit")
      .upsert({ user_id: userId, max_row: maxRow }, { onConflict: "user_id" });
    if (error) return { error: error.message };
  }
  revalidatePath("/admin/dashboard-limit");
}
