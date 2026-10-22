"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendBookingSms } from "@/lib/sms";

const isoLike = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/);

const bookingSchema = z.object({
  barberId: z.string().uuid(),
  serviceId: z.string().uuid(),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: z.string().trim().min(7).max(20),
  startsAt: isoLike.refine((v) => !Number.isNaN(Date.parse(v)), {
    message: "Bad datetime",
  }),
});

// Slots are produced in Asia/Tashkent; a naive value is treated as local time.
function toUtcIso(value: string): string {
  return value.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(value)
    ? new Date(value).toISOString()
    : new Date(`${value}+05:00`).toISOString();
}

export type BookingResult =
  | { ok: true; bookingId: string }
  | { ok: false; error: string };

export async function loadSlots(
  barberId: string,
  serviceId: string,
): Promise<string[]> {
  const parsed = z
    .object({ barberId: z.string().uuid(), serviceId: z.string().uuid() })
    .safeParse({ barberId, serviceId });

  if (!parsed.success) return [];

  const supabase = await createClient();
  const { data } = await supabase.rpc("available_slots", {
    p_barber_id: parsed.data.barberId,
    p_service_id: parsed.data.serviceId,
    p_days: 7,
  });

  return (data ?? []).map((slot) => slot.starts_at);
}

export async function createBooking(formData: FormData): Promise<BookingResult> {
  const parsed = bookingSchema.safeParse({
    barberId: formData.get("barberId"),
    serviceId: formData.get("serviceId"),
    customerName: formData.get("customerName"),
    customerPhone: formData.get("customerPhone"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const input = parsed.data;

  const { data, error } = await supabase.rpc("create_booking", {
    p_barber_id: input.barberId,
    p_service_id: input.serviceId,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone,
    p_starts_at: toUtcIso(input.startsAt),
  });

  if (error) {
    console.error("booking failed", error.code, error.message);
    return { ok: false, error: "booking_failed" };
  }

  const result = data as unknown as {
    booking_id: string;
    sms_id: string | null;
    sms_to: string | null;
    sms_body: string | null;
  } | null;

  if (!result?.booking_id) {
    console.error("booking returned no id", data);
    return { ok: false, error: "booking_failed" };
  }

  if (result.sms_id && result.sms_to && result.sms_body) {
    await sendBookingSms({
      smsId: result.sms_id,
      to: result.sms_to,
      body: result.sms_body,
    });
  }

  revalidatePath("/dashboard");
  return { ok: true, bookingId: result.booking_id };
}

export async function cancelMyBooking(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("bookingId") ?? "");

  if (!z.string().uuid().safeParse(bookingId).success) {
    return;
  }

  const supabase = await createClient();
  await supabase.rpc("cancel_own_booking", { p_booking_id: bookingId });

  revalidatePath("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
