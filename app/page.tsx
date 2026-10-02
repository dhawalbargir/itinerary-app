import Link from "next/link";
import { desc, sql, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { BedDouble, Plane } from "lucide-react";
import { db, items, trips } from "@/lib/db";
import { tripRange } from "@/lib/format";
import { NewTrip } from "@/components/NewTrip";
import { AppNav } from "@/components/AppNav";

export const dynamic = "force-dynamic";

type Row = {
  id: string; title: string; startDate: string | null; endDate: string | null;
  count: number; flights: number; stays: number; route: string[] | null;
};

export default async function Home() {
  const rows: Row[] = await db()
    .select({
      id: trips.id, title: trips.title, startDate: trips.startDate, endDate: trips.endDate,
      count: sql<number>`count(${items.id})::int`,
      flights: sql<number>`count(*) filter (where ${items.type} = 'flight')::int`,
      stays: sql<number>`count(*) filter (where ${items.type} = 'hotel_checkin')::int`,
      route: sql<string[] | null>`array_agg(${items.origin} || '>' || ${items.destination} order by ${items.startAt}) filter (where ${items.type} = 'flight')`,
    })
    .from(trips)
    .leftJoin(items, eq(items.tripId, trips.id))
    .groupBy(trips.id)
    .orderBy(desc(trips.startDate), desc(trips.createdAt));

  const today = DateTime.now().toISODate()!;
  const upcoming = rows.filter((t) => !t.endDate || t.endDate >= today).reverse();
  const past = rows.filter((t) => t.endDate && t.endDate < today);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {rows.length === 0 ? (
          <div className="hero rounded-box bg-base-100 py-16">
            <div className="hero-content max-w-xl flex-col text-center">
              <h1 className="wide text-4xl font-extrabold sm:text-5xl">Every ticket, in order</h1>
              <p className="text-base-content/70">
                Create a trip, then drop in boarding passes, e-tickets and hotel confirmations. Each one is read and placed on the right day.
              </p>
              <div className="mt-2"><NewTrip size="lg" /></div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="wide text-3xl font-extrabold sm:text-4xl">Your trips</h1>
              <NewTrip />
            </div>
            {upcoming.length > 0 && <TripGrid title="Coming up" trips={upcoming} today={today} />}
            {past.length > 0 && <TripGrid title="Past trips" trips={past} today={today} past />}
          </>
        )}
      </main>
    </>
  );
}

function countdown(t: Row, today: string) {
  if (!t.startDate) return { text: "No dates yet", cls: "badge-ghost" };
  if (t.endDate && t.endDate < today) return null;
  if (t.startDate <= today) return { text: "On now", cls: "badge-secondary" };
  const days = Math.round(DateTime.fromISO(t.startDate).diff(DateTime.fromISO(today), "days").days);
  return { text: days === 1 ? "Tomorrow" : `In ${days} days`, cls: "badge-primary badge-soft" };
}

/** "BOM HKG MNL" from ordered legs, collapsing connections. */
function routeCodes(route: string[] | null) {
  const out: string[] = [];
  for (const leg of route ?? []) {
    const [a, b] = leg.split(">");
    if (a && out.at(-1) !== a) out.push(a);
    if (b) out.push(b);
  }
  return out.slice(0, 6);
}

function TripGrid({ title, trips, today, past }: { title: string; trips: Row[]; today: string; past?: boolean }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-semibold text-base-content/70">{title}</h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((t) => {
          const badge = countdown(t, today);
          const codes = routeCodes(t.route);
          return (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`}
                className={`card card-border h-full bg-base-100 transition-shadow hover:shadow-lg focus-visible:shadow-lg ${past ? "opacity-80" : ""}`}>
                <div className="card-body gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="card-title wide text-lg leading-tight">{t.title}</h3>
                    {badge && <span className={`badge badge-sm shrink-0 ${badge.cls}`}>{badge.text}</span>}
                  </div>
                  <p className="text-sm text-base-content/70">{tripRange(t.startDate, t.endDate)}</p>
                  {codes.length > 0 && (
                    <p className="wide flex flex-wrap items-center gap-x-1.5 font-bold" aria-label={`Route ${codes.join(" to ")}`}>
                      {codes.map((c, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                          {i > 0 && <span className="h-px w-3 bg-base-content/40" aria-hidden />}
                          {c}
                        </span>
                      ))}
                    </p>
                  )}
                  <div className="mt-auto flex gap-4 text-sm text-base-content/70">
                    <span className="flex items-center gap-1.5"><Plane className="size-4" aria-hidden />{t.flights} {t.flights === 1 ? "flight" : "flights"}</span>
                    <span className="flex items-center gap-1.5"><BedDouble className="size-4" aria-hidden />{t.stays} {t.stays === 1 ? "stay" : "stays"}</span>
                    <span className="ml-auto">{t.count} {t.count === 1 ? "item" : "items"}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
