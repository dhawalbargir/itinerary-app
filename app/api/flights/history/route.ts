import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, items } from "@/lib/db";
import { bad, handle } from "@/lib/api";
import { normaliseFlightNo } from "@/lib/flights/normalise";
import { getFlightHistory } from "@/lib/flights/history";
import { toLocal } from "@/lib/time/normalise";

export const maxDuration = 60;

/** GET /api/flights/history?itemId=…&days=7|14[&cachedOnly=1] — cachedOnly never calls the provider (card badges). */
export async function GET(req: Request) {
  return handle(async () => {
    const url = new URL(req.url);
    const itemId = url.searchParams.get("itemId");
    const days = url.searchParams.get("days") === "14" ? 14 : 7;
    if (!itemId) return bad("itemId is required.");
    const [item] = await db().select().from(items).where(eq(items.id, itemId));
    if (!item || item.type !== "flight") return bad("Flight not found.", 404);

    // Codeshare: track the operating flight when the ticket names one.
    const flightNo = normaliseFlightNo(item.operatingCarrier ?? item.carrier, item.operatingNumber ?? item.number);
    const depIata = item.origin?.toUpperCase();
    if (!flightNo || !depIata || !/^[A-Z]{3}$/.test(depIata) || !item.startAt) {
      return NextResponse.json({ error: "Add the flight number, departure airport and date to see its track record.", incomplete: true }, { status: 422 });
    }
    const bookedDate = toLocal(item.startAt, item.startTz).toISODate()!;
    const cachedOnly = url.searchParams.get("cachedOnly") === "1";
    const result = await getFlightHistory({ flightNo, depIata, bookedDate, days, cachedOnly });
    const marketed = normaliseFlightNo(item.carrier, item.number);
    return NextResponse.json({ ...result, bookedDate, marketed: marketed !== flightNo ? marketed : null });
  });
}
