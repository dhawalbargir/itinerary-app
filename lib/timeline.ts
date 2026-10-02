import { DateTime } from "luxon";
import { getAirport } from "./time/airports";
import { TRANSPORT, type ItemDTO } from "./types";

// TL-1 tie-break order for items starting at the same instant.
const TYPE_ORDER = ["flight", "train", "bus", "ferry", "transfer", "car_dropoff", "hotel_checkout",
  "car_pickup", "hotel_checkin", "activity", "restaurant", "other"];
const rank = (t: string) => { const i = TYPE_ORDER.indexOf(t); return i === -1 ? 99 : i; };

export type Entry = {
  item: ItemDTO;
  startLocal: string;          // "06:10"
  endLocal: string | null;     // "08:25"
  endDayOffset: number;        // +1 for next-day arrival (DT-5)
  afterArrival: boolean;       // check-in moved after the flight that gets you there
  gapBefore: { minutes: number; kind: "layover" | "gap" } | null;
  warning: string | null;      // TL-4
};

export type Day = {
  date: string;                // YYYY-MM-DD in the zone of the items' starts
  cities: string[];            // where the day starts, then each new city reached
  staying: string[];           // hotels (or cars) held across this day (TL-3)
  entries: Entry[];
};

export type Timeline = { unscheduled: ItemDTO[]; days: Day[] };

const fallbackZone = "UTC";

export function placeCity(code: string | null, type: string): string | null {
  if (!code) return null;
  if (type === "flight") return getAirport(code)?.city || code;
  return code;
}

// A check-in or pickup time is the earliest you may arrive, not when you will.
const AFTER_ARRIVAL = new Set(["hotel_checkin", "car_pickup"]);
const ARRIVAL_WINDOW_MS = 18 * 3600 * 1000;

/** Does this transport leg bring you to the place of `item` (different zone, or the same city)? */
function bringsYouTo(leg: ItemDTO, item: ItemDTO) {
  // Lands in the item's time zone, having left from a different one (Hong Kong → Manila for a Pasay hotel).
  if (leg.endTz && item.startTz && leg.endTz === item.startTz && leg.startTz !== item.startTz) return true;
  // Same zone (domestic): the leg's destination city matches the item's city or address.
  const to = leg.destinationCity ?? leg.destination;
  const from = leg.originCity ?? leg.origin;
  if (!to || sameCity(from, to)) return false;
  const place = `${item.origin ?? ""} ${item.address ?? ""}`.toLowerCase();
  return sameCity(to, item.origin) || place.includes(to.toLowerCase());
}

/**
 * Time used for ordering. A check-in (or car pickup) that opens before you land is moved
 * to just after the arrival of the leg that brings you there, if it lands within 18 h.
 */
export function effectiveStarts(items: ItemDTO[]) {
  const eff = new Map<string, number>();
  const legs = items.filter((i) => TRANSPORT.has(i.type) && i.startAt && i.endAt);
  for (const i of items) {
    if (!i.startAt) continue;
    let t = Date.parse(i.startAt);
    if (AFTER_ARRIVAL.has(i.type)) {
      const arrivals = legs
        .map((l) => ({ l, end: Date.parse(l.endAt!) }))
        .filter(({ l, end }) => end > t && end - t <= ARRIVAL_WINDOW_MS && bringsYouTo(l, i))
        .sort((a, b) => a.end - b.end);
      if (arrivals.length) t = arrivals[0].end + 60_000;
    }
    eff.set(i.id, t);
  }
  return eff;
}

export function sortItems(list: ItemDTO[], eff = effectiveStarts(list)) {
  return [...list].sort((a, b) => {
    const ta = eff.get(a.id)!, tb = eff.get(b.id)!;
    if (ta !== tb) return ta - tb;
    return rank(a.type) - rank(b.type);
  });
}

export function buildTimeline(all: ItemDTO[]): Timeline {
  const unscheduled = all.filter((i) => !i.startAt);
  const scheduled = all.filter((i) => i.startAt);
  const eff = effectiveStarts(scheduled);
  const sorted = sortItems(scheduled, eff);

  const days: Day[] = [];
  const byDate = new Map<string, Day>();
  let lastCity: string | null = null;
  let prev: ItemDTO | null = null;
  let lastArrivalTz: string | null = null;

  for (const item of sorted) {
    const zone = item.startTz || fallbackZone;
    const start = DateTime.fromISO(item.startAt!).setZone(zone);
    const end = item.endAt ? DateTime.fromISO(item.endAt).setZone(item.endTz || zone) : null;
    const placedAt = DateTime.fromMillis(eff.get(item.id)!).setZone(zone);
    const afterArrival = placedAt.toMillis() !== start.toMillis();
    const date = placedAt.toISODate()!; // a moved check-in sits on the day you arrive

    let day = byDate.get(date);
    if (!day) {
      day = { date, cities: lastCity ? [lastCity] : [], staying: [], entries: [] };
      byDate.set(date, day);
      days.push(day);
    }

    let gapBefore: Entry["gapBefore"] = null;
    let warning: string | null = null;
    if (prev) {
      const prevEnd = prev.endAt ? Date.parse(prev.endAt) : eff.get(prev.id)!;
      const minutes = Math.round((eff.get(item.id)! - prevEnd) / 60000);
      const bothTransport = TRANSPORT.has(prev.type) && TRANSPORT.has(item.type);
      if (minutes < 0 && prev.endAt) {
        warning = `Overlaps the previous item by ${fmtDuration(-minutes)}`;
      } else if (bothTransport && minutes >= 0 && minutes < 60) {
        warning = `Tight connection: ${fmtDuration(minutes)}`;
      }
      // Layovers always; other gaps only when short and on the same day (no "free time 19 h" overnight).
      const sameDay = DateTime.fromMillis(prevEnd).setZone(zone).toISODate() === date;
      if (minutes > 0 && bothTransport && minutes < 24 * 60) gapBefore = { minutes, kind: "layover" };
      else if (minutes >= 30 && minutes < 6 * 60 && sameDay) gapBefore = { minutes, kind: "gap" };
    }

    const endDayOffset = end
      ? Math.round(end.startOf("day").diff(start.startOf("day"), "days").days)
      : 0;

    day.entries.push({
      item,
      startLocal: start.toFormat("HH:mm"),
      endLocal: end ? end.toFormat("HH:mm") : null,
      endDayOffset,
      afterArrival,
      gapBefore,
      warning,
    });

    // Cities: transport adds its origin (if new) and destination; other items add their city.
    const push = (c: string | null) => { if (c && !sameCity(day!.cities.at(-1), c)) day!.cities.push(c); };
    if (TRANSPORT.has(item.type)) {
      push(placeCity(item.origin, item.type));
      push(placeCity(item.destination, item.type));
      lastArrivalTz = item.endTz ?? item.startTz;
    } else if (!(item.startTz && item.startTz === lastArrivalTz)) {
      // A hotel in the zone you just flew into is the same place ("Pasay" after landing in Manila).
      push(placeCity(item.origin, item.type));
    }
    lastCity = day.cities.at(-1) ?? lastCity;
    prev = item;
  }

  // Stays: hotel (or car) held from check-in day until the day before check-out (TL-3).
  const groups = new Map<string, { in?: ItemDTO; out?: ItemDTO }>();
  for (const i of sorted) {
    if (!i.bookingGroup) continue;
    const g = groups.get(i.bookingGroup) ?? {};
    if (i.type === "hotel_checkin" || i.type === "car_pickup") g.in = i;
    if (i.type === "hotel_checkout" || i.type === "car_dropoff") g.out = i;
    groups.set(i.bookingGroup, g);
  }
  for (const g of groups.values()) {
    if (!g.in || !g.out || g.in.type !== "hotel_checkin") continue;
    const from = DateTime.fromMillis(eff.get(g.in.id)!).setZone(g.in.startTz || fallbackZone).toISODate()!;
    const to = DateTime.fromISO(g.out.startAt!).setZone(g.out.startTz || fallbackZone).toISODate()!;
    const name = g.in.title.replace(/^Check in:\s*/, "");
    for (const d of days) if (d.date > from && d.date < to) d.staying.push(name);
  }

  return { unscheduled, days };
}

/** "New Delhi" and "Delhi", or "Mumbai" and "mumbai", count as one city. */
export function sameCity(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const x = a.toLowerCase().trim(), y = b.toLowerCase().trim();
  return x === y || x.includes(y) || y.includes(x);
}

export function fmtDuration(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} m`;
  if (!m) return `${h} h`;
  return `${h} h ${m} m`;
}
