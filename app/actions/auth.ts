"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkWriteAdmin } from "@/lib/auth-guard";

export async function login(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  });

  if (error) {
    return { error: "メールアドレスまたはパスワードが間違っています。" };
  }

  // ログインユーザーのメールアドレスを profiles に保存
  const { data: { user: loggedInUser } } = await supabase.auth.getUser();
  if (loggedInUser?.email) {
    await supabase.from("profiles").upsert(
      { id: loggedInUser.id, email: loggedInUser.email },
      { onConflict: "id" }
    );
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function setDepreciationMode(enabled: boolean) {
  const authErr = await checkWriteAdmin(); if (authErr) return;
  const c = await cookies();
  c.set("depreciation_mode", enabled ? "1" : "0", { path: "/" });
  revalidatePath("/", "layout");
}
