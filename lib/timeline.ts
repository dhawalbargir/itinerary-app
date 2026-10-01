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

export function sortItems(list: ItemDTO[]) {
  return [...list].sort((a, b) => {
    const ta = Date.parse(a.startAt!), tb = Date.parse(b.startAt!);
    if (ta !== tb) return ta - tb;
    return rank(a.type) - rank(b.type);
  });
}

export function buildTimeline(all: ItemDTO[]): Timeline {
  const unscheduled = all.filter((i) => !i.startAt);
  const sorted = sortItems(all.filter((i) => i.startAt));

  const days: Day[] = [];
  const byDate = new Map<string, Day>();
  let lastCity: string | null = null;
  let prev: ItemDTO | null = null;

  for (const item of sorted) {
    const zone = item.startTz || fallbackZone;
    const start = DateTime.fromISO(item.startAt!).setZone(zone);
    const end = item.endAt ? DateTime.fromISO(item.endAt).setZone(item.endTz || zone) : null;
    const date = start.toISODate()!;

    let day = byDate.get(date);
    if (!day) {
      day = { date, cities: lastCity ? [lastCity] : [], staying: [], entries: [] };
      byDate.set(date, day);
      days.push(day);
    }

    let gapBefore: Entry["gapBefore"] = null;
    let warning: string | null = null;
    if (prev) {
      const prevEnd = Date.parse(prev.endAt ?? prev.startAt!);
      const minutes = Math.round((Date.parse(item.startAt!) - prevEnd) / 60000);
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
      gapBefore,
      warning,
    });

    // Cities: transport adds its origin (if new) and destination; other items add their city.
    const push = (c: string | null) => { if (c && !sameCity(day!.cities.at(-1), c)) day!.cities.push(c); };
    if (TRANSPORT.has(item.type)) {
      push(placeCity(item.origin, item.type));
      push(placeCity(item.destination, item.type));
    } else {
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
    const from = DateTime.fromISO(g.in.startAt!).setZone(g.in.startTz || fallbackZone).toISODate()!;
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
