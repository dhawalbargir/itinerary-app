import type { FlightDataProvider, ProviderDay } from "./provider";
import { statusFromDelay, type DayStatus } from "./summary";

// Response shapes differ slightly between AeroDataBox API versions; parse defensively.
type Time = { utc?: string; local?: string } | undefined;
type Movement = {
  airport?: { iata?: string; timeZone?: string };
  scheduledTime?: Time; revisedTime?: Time; runwayTime?: Time; actualTime?: Time;
  scheduledTimeUtc?: string; actualTimeUtc?: string;
};
type Flight = { status?: string; departure?: Movement; arrival?: Movement; aircraft?: { model?: string } };

function iso(s: string | undefined) {
  if (!s) return null;
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d.toISOString();
}
const sched = (m?: Movement) => iso(m?.scheduledTime?.utc ?? m?.scheduledTimeUtc);
const actual = (m?: Movement) => iso(m?.runwayTime?.utc ?? m?.actualTime?.utc ?? m?.actualTimeUtc ?? m?.revisedTime?.utc);

export function mapFlight(f: Flight, isPast: boolean): ProviderDay {
  const schedDep = sched(f.departure), schedArr = sched(f.arrival);
  const actualDep = actual(f.departure), actualArr = actual(f.arrival);
  const s = (f.status ?? "").toLowerCase();
  let status: DayStatus;
  let delay: number | null = null;

  if (s.startsWith("cancel")) status = "cancelled";
  else if (s.startsWith("divert")) status = "diverted";
  else {
    if (schedArr && actualArr && (s === "arrived" || isPast)) delay = Math.round((Date.parse(actualArr) - Date.parse(schedArr)) / 60000);
    else if (schedDep && actualDep && isPast) delay = Math.round((Date.parse(actualDep) - Date.parse(schedDep)) / 60000);
    status = delay != null ? statusFromDelay(delay) : isPast ? "unknown" : "scheduled";
  }

  return {
    depIata: f.departure?.airport?.iata ?? null,
    status,
    schedDep, actualDep, schedArr, actualArr,
    depTz: f.departure?.airport?.timeZone ?? null,
    arrTz: f.arrival?.airport?.timeZone ?? null,
    arrDelayMin: delay,
    aircraft: f.aircraft?.model ?? null,
  };
}

export const aerodatabox: FlightDataProvider = {
  name: "aerodatabox",
  configured: () => !!process.env.AERODATABOX_API_KEY,
  async fetchDay(flightNo, dateLocal) {
    const host = process.env.AERODATABOX_HOST || "aerodatabox.p.rapidapi.com";
    const url = `https://${host}/flights/number/${encodeURIComponent(flightNo)}/${dateLocal}?withAircraftImage=false&withLocation=false&dateLocalRole=Departure`;
    const res = await fetch(url, {
      headers: { "X-RapidAPI-Key": process.env.AERODATABOX_API_KEY!, "X-RapidAPI-Host": host },
      cache: "no-store",
    });
    if (res.status === 204 || res.status === 404) return "not_operating";
    if (!res.ok) throw new Error(`Flight data provider returned HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) return "not_operating";
    const list = JSON.parse(text) as Flight[];
    if (!Array.isArray(list) || !list.length) return "not_operating";
    const today = new Date().toISOString().slice(0, 10);
    return list.map((f) => mapFlight(f, dateLocal < today));
  },
};
