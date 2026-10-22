"use client";

import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createBooking, loadSlots } from "@/app/actions/booking";
import { formatPrice, formatSlot } from "@/lib/format";

export type BookingService = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
};

type Props = {
  barberId: string;
  services: BookingService[];
};

export default function BookingForm({ barberId, services }: Props) {
  const t = useTranslations("booking");
  const locale = useLocale();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [slotsByService, setSlotsByService] = useState<
    Record<string, string[]>
  >({});
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const slots = serviceId ? slotsByService[serviceId] : undefined;
  const isLoading = serviceId !== "" && slots === undefined;

  useEffect(() => {
    if (!serviceId || slotsByService[serviceId]) return;

    let active = true;

    loadSlots(barberId, serviceId)
      .then((result) => {
        if (active) {
          setSlotsByService((prev) => ({ ...prev, [serviceId]: result }));
        }
      })
      .catch(() => {
        if (active) {
          setSlotsByService((prev) => ({ ...prev, [serviceId]: [] }));
        }
      });

    return () => {
      active = false;
    };
  }, [barberId, serviceId, slotsByService]);

  function submit(formData: FormData) {
    setMessage("");

    startTransition(async () => {
      const result = await createBooking(formData);

      if (!result.ok) {
        setMessage(
          result.error === "invalid" ? t("invalidData") : t("conflict"),
        );
        return;
      }

      setMessage(t("success", { id: result.bookingId.slice(0, 8) }));

      const fresh = await loadSlots(barberId, serviceId).catch(() => []);
      setSlotsByService((prev) => ({ ...prev, [serviceId]: fresh }));
    });
  }

  return (
    <form action={submit} className="space-y-4">
      <input type="hidden" name="barberId" value={barberId} />

      <label className="block text-sm font-medium">
        {t("service")}
        <select
          name="serviceId"
          required
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          className="mt-2 w-full rounded-xl border p-3"
        >
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} — {formatPrice(service.price, locale)} so&apos;m (
              {service.duration_minutes} min)
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        {t("name")}
        <input
          name="customerName"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          className="mt-2 w-full rounded-xl border p-3"
          placeholder={t("namePlaceholder")}
        />
      </label>

      <label className="block text-sm font-medium">
        {t("phone")}
        <input
          name="customerPhone"
          required
          autoComplete="tel"
          className="mt-2 w-full rounded-xl border p-3"
          placeholder={t("phonePlaceholder")}
        />
      </label>

      <label className="block text-sm font-medium">
        {t("slot")}
        <select
          name="startsAt"
          required
          className="mt-2 w-full rounded-xl border p-3"
          disabled={isLoading}
        >
          <option value="">
            {isLoading
              ? t("slotLoading")
              : slots && slots.length === 0
                ? t("slotEmpty")
                : t("slot")}
          </option>
          {(slots ?? []).map((slot) => (
            <option key={slot} value={slot}>
              {formatSlot(slot, locale)}
            </option>
          ))}
        </select>
      </label>

      <button
        disabled={isPending || services.length === 0}
        className="w-full rounded-xl bg-amber-500 px-5 py-3 font-bold disabled:opacity-50"
      >
        {isPending ? t("submitting") : t("submit")}
      </button>

      {message && (
        <p aria-live="polite" className="break-words text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
