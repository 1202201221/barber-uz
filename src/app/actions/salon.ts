"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/types";

const bookingStatuses: BookingStatus[] = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
];

export async function createSalon(formData: FormData): Promise<void> {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      city: z.string().trim().min(2).max(80),
      address: z.string().trim().min(3).max(240),
      district: z.string().trim().max(80),
      phone: z.string().trim().max(30),
      description: z.string().trim().max(2000),
    })
    .safeParse({
      name: formData.get("name"),
      city: formData.get("city"),
      address: formData.get("address"),
      district: String(formData.get("district") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      description: String(formData.get("description") ?? ""),
    });

  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_create_salon", {
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_phone: parsed.data.phone,
    p_address: parsed.data.address,
    p_city: parsed.data.city,
    p_district: parsed.data.district,
  });

  if (error) {
    console.error("createSalon failed", error.message);
    return;
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin");
}

export async function setBookingStatus(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "");
  const status = String(formData.get("status") ?? "") as BookingStatus;

  if (!z.string().uuid().safeParse(bookingId).success) return;
  if (!bookingStatuses.includes(status)) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("owner_update_booking", {
    p_booking_id: bookingId,
    p_status: status,
  });

  if (error) {
    console.error("setBookingStatus failed", error.message);
    return;
  }

  revalidatePath("/dashboard");
}
