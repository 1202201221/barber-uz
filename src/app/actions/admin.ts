"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();

export async function reviewSalon(formData: FormData): Promise<void> {
  const salonId = String(formData.get("salonId") ?? "");
  const approve = formData.get("approve") === "true";

  if (!uuid.safeParse(salonId).success) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return;

  const { error } = await supabase.rpc("admin_approve_salon", {
    p_salon_id: salonId,
    p_approved: approve,
  });

  if (error) {
    console.error("reviewSalon failed", error.message);
    return;
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/barbers");
}
