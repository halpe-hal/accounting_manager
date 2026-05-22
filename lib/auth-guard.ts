import { createClient } from "@/lib/supabase/server";

const WRITE_ADMIN_EMAIL = "admin@kklia.com";

export const PERMISSION_ERROR = { error: "この操作を行う権限がありません。" } as const;

export async function checkWriteAdmin(): Promise<typeof PERMISSION_ERROR | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.email !== WRITE_ADMIN_EMAIL) {
    return PERMISSION_ERROR;
  }
  return null;
}
