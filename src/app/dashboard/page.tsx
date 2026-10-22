import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cancelMyBooking } from "@/app/actions/booking";
import { createSalon, setBookingStatus } from "@/app/actions/salon";
import { getCurrentProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatPrice } from "@/lib/format";

export default async function DashboardPage() {
  const t = await getTranslations();

  if (!isSupabaseConfigured) redirect("/login");

  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  const locale = profile.locale;

  const supabase = await createClient();

  if (profile.role === "customer") {
    const { data: myBookings } = await supabase
      .from("bookings")
      .select(`
        id, customer_name, starts_at, ends_at,
        status, price_snapshot,
        barbers!inner(display_name, salon_id),
        services(name)
      `)
      .eq("customer_id", profile.id)
      .order("starts_at", { ascending: false })
      .limit(30);

    return (
      <main className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-black">{t("dashboard.bookings")}</h1>
        <p className="mt-2 text-neutral-500">
          {t("dashboard.welcome", {
            name: profile.full_name || t("dashboard.guest"),
          })}
        </p>

        <div className="mt-6 grid gap-3">
          {(myBookings ?? []).map((booking) => {
            const barber = Array.isArray(booking.barbers)
              ? booking.barbers[0]
              : booking.barbers;

            return (
              <div
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-5"
              >
                <div>
                  <p className="font-bold">
                    {barber?.display_name} · {booking.services?.name}
                  </p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {formatDateTime(booking.starts_at, locale)} ·{" "}
                    {formatPrice(booking.price_snapshot, locale)}{" "}
                    {t("common.som")} ·{" "}
                    {t(`common.status.${booking.status}`)}
                  </p>
                </div>

                {(booking.status === "confirmed" ||
                  booking.status === "pending") && (
                  <form action={cancelMyBooking}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">
                      {t("dashboard.cancel")}
                    </button>
                  </form>
                )}
              </div>
            );
          })}

          {!myBookings || myBookings.length === 0 ? (
            <p className="rounded-xl border border-dashed p-8 text-center text-neutral-500">
              {t("dashboard.empty")}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  if (profile.role === "barber") {
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-black">{t("dashboard.title")}</h1>
        <p className="mt-3 text-neutral-500">{t("dashboard.roleRequired")}</p>
      </main>
    );
  }

  const { data: salons } = await supabase
    .from("salons")
    .select("id, name, slug, description, phone, address, city, district, latitude, longitude, status, owner_id, created_at")
    .eq("owner_id", profile.id);

  const salonIds = (salons ?? []).map((salon) => salon.id);

  const { data: bookings } = salonIds.length
    ? await supabase
        .from("bookings")
        .select(`
          id, customer_name, customer_phone, starts_at, ends_at,
          status, price_snapshot,
          barbers!inner(display_name, salon_id),
          services(name)
        `)
        .in("barbers.salon_id", salonIds)
        .order("starts_at", { ascending: true })
        .limit(100)
    : { data: [] };

  const canCreateSalon = profile.role === "owner" || profile.role === "admin";

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <h1 className="text-3xl font-black">{t("dashboard.title")}</h1>
      <p className="mt-2 text-neutral-500">
        {t("dashboard.welcome", {
          name: profile.full_name || t("dashboard.guest"),
        })}
      </p>

      <div className="my-7 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-neutral-500">{t("dashboard.statSalons")}</p>
          <p className="mt-2 text-3xl font-black">{salons?.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-neutral-500">
            {t("dashboard.statBookings")}
          </p>
          <p className="mt-2 text-3xl font-black">{bookings?.length ?? 0}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5">
          <p className="text-sm text-neutral-500">
            {t("dashboard.statApproved")}
          </p>
          <p className="mt-2 text-3xl font-black">
            {salons?.filter((salon) => salon.status === "approved").length ?? 0}
          </p>
        </div>
      </div>

      {canCreateSalon && (
        <section className="mb-10 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">{t("dashboard.newSalon")}</h2>
          <form action={createSalon} className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              name="name"
              required
              minLength={2}
              placeholder={t("dashboard.salonName")}
              className="rounded-xl border p-3"
            />
            <input
              name="city"
              required
              minLength={2}
              placeholder={t("dashboard.salonCity")}
              className="rounded-xl border p-3"
            />
            <input
              name="address"
              required
              minLength={3}
              placeholder={t("dashboard.salonAddress")}
              className="rounded-xl border p-3 md:col-span-2"
            />
            <input
              name="district"
              placeholder={t("dashboard.salonDistrict")}
              className="rounded-xl border p-3"
            />
            <input
              name="phone"
              placeholder={t("dashboard.salonPhone")}
              className="rounded-xl border p-3"
            />
            <textarea
              name="description"
              rows={3}
              placeholder={t("dashboard.salonDescription")}
              className="rounded-xl border p-3 md:col-span-2"
            />
            <button className="rounded-xl bg-neutral-900 px-5 py-3 font-semibold text-white md:col-span-2">
              {t("dashboard.salonSubmit")}
            </button>
          </form>
        </section>
      )}

      <h2 className="mb-4 text-xl font-bold">{t("dashboard.bookings")}</h2>
      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-100">
            <tr>
              <th className="p-4">{t("dashboard.colCustomer")}</th>
              <th className="p-4">{t("dashboard.colBarber")}</th>
              <th className="p-4">{t("dashboard.colService")}</th>
              <th className="p-4">{t("dashboard.colTime")}</th>
              <th className="p-4">{t("dashboard.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((booking) => {
              const salon = Array.isArray(booking.barbers)
                ? booking.barbers[0]
                : booking.barbers;

              return (
                <tr key={booking.id} className="border-t align-top">
                  <td className="p-4">
                    {booking.customer_name}
                    <div className="text-neutral-500">
                      {booking.customer_phone}
                    </div>
                    <div className="mt-1 font-semibold">
                      {formatPrice(booking.price_snapshot, locale)}{" "}
                      {t("common.som")}
                    </div>
                  </td>
                  <td className="p-4">{salon?.display_name}</td>
                  <td className="p-4">{booking.services?.name}</td>
                  <td className="p-4">
                    {formatDateTime(booking.starts_at, locale)}
                  </td>
                  <td className="p-4">
                    <div className="mb-2">
                      {t(`common.status.${booking.status}`)}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <form action={setBookingStatus}>
                        <input
                          type="hidden"
                          name="bookingId"
                          value={booking.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value="completed"
                        />
                        <button className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white">
                          {t("dashboard.complete")}
                        </button>
                      </form>
                      <form action={setBookingStatus}>
                        <input
                          type="hidden"
                          name="bookingId"
                          value={booking.id}
                        />
                        <input
                          type="hidden"
                          name="status"
                          value="cancelled"
                        />
                        <button className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">
                          {t("dashboard.cancel")}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!bookings || bookings.length === 0 ? (
          <p className="p-8 text-center text-neutral-500">
            {t("dashboard.empty")}
          </p>
        ) : null}
      </div>
    </main>
  );
}
