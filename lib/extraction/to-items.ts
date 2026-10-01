import { randomUUID } from "node:crypto";
import type { NewItem } from "@/lib/db/schema";
import { getAirport } from "@/lib/time/airports";
import { localToUtc, resolveZone, DEFAULT_TZ } from "@/lib/time/normalise";
import type { ExtractedItemT } from "./schema";

type Draft = Omit<NewItem, "tripId">;

const clean = (s: string | null | undefined) => {
  const t = s?.trim();
  return t ? t : null;
};

/**
 * Turn model output into item rows (DT-1, DT-2, TL-3): resolve zones, convert to UTC,
 * split hotels and rentals into two linked events.
 */
export function extractedToItems(
  list: ExtractedItemT[],
  opts: { fallbackTz?: string; now?: Date } = {},
): Draft[] {
  const fallback = opts.fallbackTz ?? DEFAULT_TZ;
  const out: Draft[] = [];

  for (const x of list) {
    const conf: Record<string, number> = { ...(x.confidence ?? {}) };
    const isFlight = x.type === "flight";
    // Only flights look places up as airports ("GOA" is Genoa, not Goa).
    const startZone = resolveZone(isFlight ? x.start_place : null, x.start_tz, fallback);
    const endZone = resolveZone(isFlight ? x.end_place : null, x.end_tz ?? x.start_tz, startZone);

    const base: Draft = {
      type: x.type,
      title: x.title.trim(),
      origin: isFlight ? clean(x.start_place)?.toUpperCase() ?? null : clean(x.start_place),
      destination: isFlight ? clean(x.end_place)?.toUpperCase() ?? null : clean(x.end_place),
      address: clean(x.address),
      confirmationCode: clean(x.confirmation_code),
      carrier: clean(x.carrier)?.toUpperCase().replace(/\s+/g, "") ?? null,
      number: clean(x.number)?.replace(/\s+/g, "").replace(/^0+(?=\d)/, "") ?? null,
      operatingCarrier: clean(x.operating_carrier)?.toUpperCase() ?? null,
      operatingNumber: clean(x.operating_number)?.replace(/^0+(?=\d)/, "") ?? null,
      seat: clean(x.seat),
      terminal: clean(x.terminal),
      gate: clean(x.gate),
      travellers: x.travellers?.filter(Boolean) ?? null,
      notes: clean(x.notes),
      fieldConfidence: conf,
    };

    // Flights with an unknown airport fall back to the model's zone; flag them.
    if (isFlight && x.start_place && !getAirport(x.start_place)) conf.start_local = Math.min(conf.start_local ?? 1, 0.6);

    const split = x.type === "hotel" || x.type === "car_rental";
    if (split) {
      const group = randomUUID();
      const [inType, outType, inLabel, outLabel, inTime, outTime] =
        x.type === "hotel"
          ? ["hotel_checkin", "hotel_checkout", "Check in", "Check out", "15:00", "11:00"]
          : ["car_pickup", "car_dropoff", "Pick up", "Drop off", "10:00", "10:00"];
      const s = localToUtc(x.start_local, startZone, { defaultTime: inTime, now: opts.now });
      const e = localToUtc(x.end_local, endZone, { defaultTime: outTime, now: opts.now });
      const c1 = { ...conf };
      if (s?.yearInferred) c1.start_local = Math.min(c1.start_local ?? 1, 0.65);
      out.push({ ...base, type: inType, title: `${inLabel}: ${base.title}`, bookingGroup: group,
        startAt: s?.date ?? null, startTz: startZone, endAt: null, endTz: null, fieldConfidence: c1 });
      if (x.end_local) {
        const c2 = { ...conf, start_local: conf.end_local ?? conf.start_local ?? 1 };
        if (e?.yearInferred) c2.start_local = Math.min(c2.start_local, 0.65);
        out.push({ ...base, type: outType, title: `${outLabel}: ${base.title}`, bookingGroup: group,
          origin: base.destination ?? base.origin,
          startAt: e?.date ?? null, startTz: endZone, endAt: null, endTz: null, fieldConfidence: c2 });
      }
      continue;
    }

    const s = localToUtc(x.start_local, startZone, { now: opts.now });
    const e = localToUtc(x.end_local, endZone, { now: opts.now, referenceYear: undefined });
    if (s?.yearInferred) conf.start_local = Math.min(conf.start_local ?? 1, 0.65);
    if (s?.dateOnly && isFlight) conf.start_local = Math.min(conf.start_local ?? 1, 0.6);

    let endAt = e?.date ?? null;
    // An arrival printed without a date that lands before departure is next day (overnight).
    if (s && endAt && endAt < s.date) endAt = new Date(endAt.getTime() + 24 * 3600 * 1000);

    out.push({ ...base, startAt: s?.date ?? null, startTz: startZone, endAt, endTz: endAt ? endZone : null, fieldConfidence: conf });
  }
  return out;
}

/** Key used to match items between a first extraction and a re-run. */
export function matchKey(i: { type: string; carrier?: string | null; number?: string | null; title: string }) {
  if (i.carrier && i.number) return `${i.type}:${i.carrier}${i.number}`;
  return `${i.type}:${i.title.trim().toLowerCase()}`;
}
