import { DateTime, IANAZone } from "luxon";
import { getAirport } from "./airports";

export const DEFAULT_TZ = process.env.DEFAULT_TZ || "Asia/Kolkata";

export function isValidZone(z: string | null | undefined): z is string {
  return !!z && IANAZone.isValidZone(z);
}

/**
 * Pick the IANA zone. Pass an airport code only for flights (looked up in the bundled dataset, DT-1);
 * otherwise the model's zone hint is used, then the default.
 */
export function resolveZone(airportCode: string | null | undefined, tzHint: string | null | undefined, fallback = DEFAULT_TZ) {
  const ap = getAirport(airportCode);
  if (ap && isValidZone(ap.tz)) return ap.tz;
  if (isValidZone(tzHint)) return tzHint;
  return fallback;
}

/**
 * Parse a local wall-clock string as written on a document into a UTC Date.
 * Accepts "YYYY-MM-DDTHH:mm", "YYYY-MM-DD", and "--MM-DD[THH:mm]" when the year was not printed
 * (DT-4: the year becomes the one that puts the date nearest in the future, allowing 30 days back).
 * `defaultTime` is used for date-only values ("HH:mm").
 */
export function localToUtc(
  local: string | null | undefined,
  zone: string,
  opts: { defaultTime?: string; now?: Date; referenceYear?: number } = {},
): { date: Date; dateOnly: boolean; yearInferred: boolean } | null {
  if (!local) return null;
  let s = local.trim().replace(" ", "T");
  let yearInferred = false;

  if (s.startsWith("--")) {
    const now = DateTime.fromJSDate(opts.now ?? new Date()).setZone(zone);
    const rest = s.slice(2);
    let year = opts.referenceYear ?? now.year;
    let candidate = DateTime.fromISO(`${year}-${rest}`, { zone });
    if (!opts.referenceYear && candidate.isValid && candidate < now.minus({ days: 30 })) {
      year += 1;
      candidate = DateTime.fromISO(`${year}-${rest}`, { zone });
    }
    s = `${year}-${rest}`;
    yearInferred = true;
  }

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (dateOnly) s = `${s}T${opts.defaultTime ?? "00:00"}`;
  const dt = DateTime.fromISO(s, { zone });
  if (!dt.isValid) return null;
  return { date: dt.toUTC().toJSDate(), dateOnly, yearInferred };
}

export function toLocal(date: Date | string, zone: string | null | undefined) {
  return DateTime.fromJSDate(typeof date === "string" ? new Date(date) : date).setZone(zone || DEFAULT_TZ);
}

/** "YYYY-MM-DDTHH:mm" in the given zone, for edit forms. */
export function utcToLocalInput(date: Date | string | null, zone: string | null | undefined) {
  if (!date) return "";
  return toLocal(date, zone).toFormat("yyyy-MM-dd'T'HH:mm");
}
