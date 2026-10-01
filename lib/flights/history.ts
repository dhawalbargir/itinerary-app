import { and, eq, inArray, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { apiUsage, db, flightHistory } from "@/lib/db";
import { getAirport } from "@/lib/time/airports";
import { aerodatabox } from "./aerodatabox";
import type { FlightDataProvider } from "./provider";
import { summarise, type HistoryDay } from "./summary";

const provider: FlightDataProvider = aerodatabox;
const FINAL = new Set(["on_time", "delayed", "cancelled", "diverted", "not_scheduled"]);
const LIVE_TTL_MS = 5 * 60 * 1000;

/**
 * Which earlier days to show for a booked flight:
 * future trip → the last N completed days before today; past trip → N days before the booked date plus that date.
 */
export function historyDates(bookedDate: string, today: string, n: number) {
  const back = (from: string, i: number) => DateTime.fromISO(from).minus({ days: i }).toISODate()!;
  const anchor = bookedDate >= today ? today : bookedDate;
  const out: string[] = [];
  for (let i = 1; i <= n; i++) out.push(back(anchor, i));
  if (bookedDate < today) out.unshift(bookedDate); // the booked flight itself has flown
  return out; // newest first
}

async function takeQuota(): Promise<boolean> {
  const cap = Number(process.env.FLIGHT_CALLS_PER_DAY || 200);
  const day = new Date().toISOString().slice(0, 10);
  const [row] = await db()
    .insert(apiUsage)
    .values({ day, provider: provider.name, calls: 1 })
    .onConflictDoUpdate({ target: [apiUsage.day, apiUsage.provider], set: { calls: sql`${apiUsage.calls} + 1` } })
    .returning({ calls: apiUsage.calls });
  return row.calls <= cap;
}

type Row = typeof flightHistory.$inferSelect;
const toDay = (r: Row): HistoryDay => ({
  date: r.flightDate, status: r.status as HistoryDay["status"],
  schedDep: r.schedDep?.toISOString() ?? null, actualDep: r.actualDep?.toISOString() ?? null,
  schedArr: r.schedArr?.toISOString() ?? null, actualArr: r.actualArr?.toISOString() ?? null,
  depTz: r.depTz, arrTz: r.arrTz, arrDelayMin: r.arrDelayMin, aircraft: r.aircraft,
});

async function fetchAndStore(flightNo: string, depIata: string, date: string): Promise<Row | null> {
  if (!(await takeQuota())) throw new QuotaError();
  const result = await provider.fetchDay(flightNo, date);
  let v: Omit<Row, "fetchedAt">;
  const tz = getAirport(depIata)?.tz ?? null;
  if (result === "not_operating") {
    v = { flightNo, depIata, flightDate: date, status: "not_scheduled", schedDep: null, actualDep: null, schedArr: null,
      actualArr: null, depTz: tz, arrTz: null, arrDelayMin: null, aircraft: null, provider: provider.name };
  } else {
    // Match on departure airport so a reused number on another route is excluded.
    const leg = result.find((l) => l.depIata === depIata);
    if (!leg) {
      v = { flightNo, depIata, flightDate: date, status: "not_scheduled", schedDep: null, actualDep: null, schedArr: null,
        actualArr: null, depTz: tz, arrTz: null, arrDelayMin: null, aircraft: null, provider: provider.name };
    } else {
      const d = (s: string | null) => (s ? new Date(s) : null);
      v = { flightNo, depIata, flightDate: date, status: leg.status, schedDep: d(leg.schedDep), actualDep: d(leg.actualDep),
        schedArr: d(leg.schedArr), actualArr: d(leg.actualArr), depTz: leg.depTz ?? tz, arrTz: leg.arrTz,
        arrDelayMin: leg.arrDelayMin, aircraft: leg.aircraft, provider: provider.name };
    }
  }
  const [row] = await db()
    .insert(flightHistory)
    .values({ ...v, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: [flightHistory.flightNo, flightHistory.depIata, flightHistory.flightDate],
      set: { ...v, fetchedAt: new Date() },
    })
    .returning();
  return row;
}

export class QuotaError extends Error {
  constructor() { super("Daily flight-data limit reached. Try again tomorrow."); }
}

export async function getFlightHistory(opts: { flightNo: string; depIata: string; bookedDate: string; days: number; cachedOnly?: boolean }) {
  const { flightNo, depIata, bookedDate } = opts;
  const tz = getAirport(depIata)?.tz ?? "UTC";
  const today = DateTime.now().setZone(tz).toISODate()!;
  const dates = historyDates(bookedDate, today, opts.days);
  const wantLive = bookedDate === today;
  const allDates = wantLive ? [today, ...dates.filter((d) => d !== today)] : dates;

  if (!provider.configured()) {
    return { configured: false as const, flightNo, depIata, today, days: [], live: null, summary: summarise([]), limited: false };
  }

  const cached = await db().select().from(flightHistory).where(and(
    eq(flightHistory.flightNo, flightNo), eq(flightHistory.depIata, depIata), inArray(flightHistory.flightDate, allDates),
  ));
  const byDate = new Map(cached.map((r) => [r.flightDate, r]));

  let limited = false;
  const fresh = (r: Row) =>
    (r.flightDate < today && FINAL.has(r.status)) || Date.now() - r.fetchedAt.getTime() < LIVE_TTL_MS
    || (r.flightDate < today && Date.now() - r.fetchedAt.getTime() < 6 * 3600 * 1000); // past "unknown": retry every 6 h

  const missing = opts.cachedOnly ? [] : allDates.filter((d) => { const r = byDate.get(d); return !r || !fresh(r); });
  // Fetch a few at a time to stay polite with the provider.
  for (let i = 0; i < missing.length; i += 4) {
    const batch = missing.slice(i, i + 4);
    const results = await Promise.allSettled(batch.map((d) => fetchAndStore(flightNo, depIata, d)));
    results.forEach((r, j) => {
      if (r.status === "fulfilled" && r.value) byDate.set(batch[j], r.value);
      else if (r.status === "rejected") {
        if (r.reason instanceof QuotaError) limited = true;
        else console.error("[flights] fetch failed", batch[j], String(r.reason));
      }
    });
    if (limited) break;
  }

  const days = dates.filter((d) => d !== today || !wantLive).map((d) => byDate.get(d)).filter(Boolean).map((r) => toDay(r!));
  const liveRow = wantLive ? byDate.get(today) : undefined;
  return {
    configured: true as const, flightNo, depIata, today,
    days, live: liveRow ? toDay(liveRow) : null,
    summary: summarise(days.filter((d) => d.date < today)),
    limited,
  };
}
