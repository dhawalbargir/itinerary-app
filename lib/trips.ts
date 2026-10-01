import { and, eq, isNotNull } from "drizzle-orm";
import { db, items, trips } from "@/lib/db";
import { DEFAULT_TZ, toLocal } from "@/lib/time/normalise";

/** If the trip's dates were inferred, reset them from the earliest and latest items (Flow A step 5). */
export async function recomputeTripDates(tripId: string) {
  const d = db();
  const [trip] = await d.select().from(trips).where(eq(trips.id, tripId));
  if (!trip || trip.datesInferred !== "yes") return;
  const rows = await d
    .select({ startAt: items.startAt, startTz: items.startTz, endAt: items.endAt, endTz: items.endTz })
    .from(items)
    .where(and(eq(items.tripId, tripId), isNotNull(items.startAt)));
  if (!rows.length) {
    await d.update(trips).set({ startDate: null, endDate: null }).where(eq(trips.id, tripId));
    return;
  }
  let min: string | null = null;
  let max: string | null = null;
  for (const r of rows) {
    const s = toLocal(r.startAt!, r.startTz ?? DEFAULT_TZ).toISODate()!;
    const e = r.endAt ? toLocal(r.endAt, r.endTz ?? r.startTz ?? DEFAULT_TZ).toISODate()! : s;
    if (!min || s < min) min = s;
    if (!max || e > max) max = e;
  }
  await d.update(trips).set({ startDate: min, endDate: max }).where(eq(trips.id, tripId));
}

