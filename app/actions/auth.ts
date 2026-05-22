"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
