"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  password: z.string().min(6).max(200),
  fullName: z.string().trim().max(100),
});

export async function authenticate(formData: FormData): Promise<void> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    fullName: String(formData.get("fullName") ?? ""),
  });

  if (!parsed.success) redirect("/login?error=invalid");

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  if (formData.get("intent") === "sign_up") {
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { full_name: parsed.data.fullName },
        emailRedirectTo: `${siteUrl}/auth/callback`,
      },
    });

    if (error) redirect("/login?error=sign_up_failed");
    if (!data.session) redirect("/login?error=confirm_email");

    redirect("/dashboard");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) redirect("/login?error=sign_in_failed");

  const next = String(formData.get("next") ?? "/dashboard");
  redirect(next.startsWith("/") ? next : "/dashboard");
}
