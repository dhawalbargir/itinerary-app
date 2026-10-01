import data from "@/data/airports.json";

type Row = [tz: string, city: string, name: string];
const AIRPORTS = data as unknown as Record<string, Row>;

export type Airport = { iata: string; tz: string; city: string; name: string };

export function getAirport(code: string | null | undefined): Airport | null {
  if (!code) return null;
  const iata = code.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) return null;
  const row = AIRPORTS[iata];
  return row ? { iata, tz: row[0], city: row[1], name: row[2] } : null;
}
