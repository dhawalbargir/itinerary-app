import { DateTime } from "luxon";

export function local(iso: string, tz: string | null | undefined) {
  return DateTime.fromISO(iso).setZone(tz || "UTC");
}

/** Short zone label: a real abbreviation when the browser has one (IST, GMT, CET), else "UTC+5:30". */
export function zoneAbbr(iso: string, tz: string | null | undefined) {
  const d = local(iso, tz);
  const n = d.offsetNameShort ?? "";
  if (n && !/^(GMT|UTC)[+-]/.test(n)) return n;
  return d.offset === 0 ? "UTC" : `UTC${d.toFormat("Z")}`;
}

export function dayHeading(date: string) {
  const d = DateTime.fromISO(date);
  return { weekday: d.toFormat("cccc"), day: d.toFormat("d LLL"), year: d.toFormat("yyyy") };
}

export function tripRange(start: string | null, end: string | null) {
  if (!start) return "Dates come from your documents";
  const s = DateTime.fromISO(start), e = end ? DateTime.fromISO(end) : s;
  if (s.hasSame(e, "day")) return s.toFormat("d LLL yyyy");
  if (s.hasSame(e, "year")) return `${s.toFormat("d LLL")} – ${e.toFormat("d LLL yyyy")}`;
  return `${s.toFormat("d LLL yyyy")} – ${e.toFormat("d LLL yyyy")}`;
}

export function hm(iso: string | null, tz: string | null | undefined) {
  return iso ? local(iso, tz).toFormat("HH:mm") : "–";
}

export function toInputValue(iso: string | null, tz: string | null | undefined) {
  return iso ? local(iso, tz).toFormat("yyyy-MM-dd'T'HH:mm") : "";
}

export function durationLabel(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} m`;
  if (!m) return `${h} h`;
  return `${h} h ${m} m`;
}
