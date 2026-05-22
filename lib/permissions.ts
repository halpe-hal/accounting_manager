import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
export { ADMIN_EMAILS, PAGE_PERMISSIONS, type PagePermissionKey } from "@/lib/page-permissions";
import { ADMIN_EMAILS } from "@/lib/page-permissions";

export const getPermissions = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  if (ADMIN_EMAILS.includes(user.email ?? "")) {
    return new Set(["*"]);
  }

  const { data } = await supabase
    .from("user_app_permissions")
    .select("app_name")
    .eq("user_id", user.id);

  return new Set((data ?? []).map((p: { app_name: string }) => p.app_name));
});

export function can(perms: Set<string>, key: string): boolean {
  return perms.has("*") || perms.has(key);
}
