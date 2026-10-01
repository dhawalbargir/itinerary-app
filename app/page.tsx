import Link from "next/link";
import { desc, sql, eq } from "drizzle-orm";
import { db, items, trips } from "@/lib/db";
import { tripRange } from "@/lib/format";
import { NewTrip } from "@/components/NewTrip";
import { SignOut } from "@/components/SignOut";

export const dynamic = "force-dynamic";

export default async function Home() {
  const rows = await db()
    .select({
      id: trips.id, title: trips.title, startDate: trips.startDate, endDate: trips.endDate,
      count: sql<number>`count(${items.id})::int`,
      places: sql<string[]>`array_remove(array_agg(distinct ${items.destination}), null)`,
    })
    .from(trips)
    .leftJoin(items, eq(items.tripId, trips.id))
    .groupBy(trips.id)
    .orderBy(desc(trips.startDate), desc(trips.createdAt));

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((t) => !t.endDate || t.endDate >= today).reverse();
  const past = rows.filter((t) => t.endDate && t.endDate < today);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="wide text-4xl font-extrabold">Trips</h1>
        <SignOut />
      </div>

      <div className="mt-6">
        <NewTrip prominent={rows.length === 0} />
      </div>

      {rows.length === 0 && (
        <p className="mt-6 text-muted">Name your first trip, then drop in its tickets and confirmations.</p>
      )}

      {upcoming.length > 0 && <TripList title="Coming up" trips={upcoming} />}
      {past.length > 0 && <TripList title="Past trips" trips={past} quiet />}
    </main>
  );
}

type Row = { id: string; title: string; startDate: string | null; endDate: string | null; count: number; places: string[] };

function TripList({ title, trips, quiet }: { title: string; trips: Row[]; quiet?: boolean }) {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {trips.map((t) => (
          <li key={t.id}>
            <Link href={`/trips/${t.id}`} className={`grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-0.5 py-4 hover:bg-surface -mx-2 px-2 rounded-lg ${quiet ? "opacity-75" : ""}`}>
              <span className="wide text-xl font-bold truncate">{t.title}</span>
              <span className="text-sm text-muted text-right">{t.count} {t.count === 1 ? "item" : "items"}</span>
              <span className="text-sm text-muted">{tripRange(t.startDate, t.endDate)}</span>
              <span className="wide text-sm text-right truncate max-w-48">{t.places.slice(0, 4).join(" ")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
