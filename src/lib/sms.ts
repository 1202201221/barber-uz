import { createClient } from "@/lib/supabase/server";

export type PendingSms = {
  smsId: string;
  to: string;
  body: string;
};

// Server-only: these are never NEXT_PUBLIC_, the credentials must not reach
// the browser bundle.
const endpoint = (process.env.SMS_PLAY_URL ?? "").trim();
const login = (process.env.SMS_PLAY_LOGIN ?? "").trim();
const password = (process.env.SMS_PLAY_PASSWORD ?? "").trim();

export const isSmsConfigured =
  endpoint.length > 0 && login.length > 0 && password.length > 0;

async function mark(
  smsId: string,
  status: "sent" | "failed" | "skipped",
  providerId: string | null,
  error: string | null,
): Promise<void> {
  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("mark_sms", {
    p_sms_id: smsId,
    p_status: status,
    p_provider_id: providerId,
    p_error: error,
  });

  if (rpcError) {
    console.error("mark_sms failed", smsId, rpcError.code, rpcError.message);
  }
}

/**
 * Best-effort barber notification. A booking is never rolled back because an
 * SMS could not be delivered — the outcome lands in public.sms_messages.
 */
export async function sendBookingSms(pending: PendingSms | null): Promise<void> {
  if (!pending) return;

  const { smsId, to, body } = pending;

  if (!isSmsConfigured) {
    console.info("SMS dry-run (SMS_PLAY_* not set)", { to, body });
    await mark(smsId, "skipped", null, "SMS_PLAY_* env is not configured");
    return;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ login, password, mobilePhone: to, message: body }),
      signal: AbortSignal.timeout(10_000),
    });

    const text = await response.text();

    if (!response.ok) {
      console.error("sms provider error", response.status, text.slice(0, 300));
      await mark(smsId, "failed", null, `HTTP ${response.status}`);
      return;
    }

    let providerId: string | null = null;
    try {
      const parsed = JSON.parse(text) as { data?: { messageId?: string }; error?: string };
      if (parsed.error) {
        console.error("sms provider rejected", parsed.error);
        await mark(smsId, "failed", null, String(parsed.error).slice(0, 200));
        return;
      }
      providerId = parsed.data?.messageId ?? null;
    } catch {
      // Non-JSON success bodies are accepted as delivered.
    }

    await mark(smsId, "sent", providerId, null);
  } catch (cause) {
    console.error("sms send failed", cause);
    await mark(smsId, "failed", null, cause instanceof Error ? cause.message : "unknown");
  }
}
