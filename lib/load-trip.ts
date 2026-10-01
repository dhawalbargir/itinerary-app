import { asc, desc, eq } from "drizzle-orm";
import { db, documents, items, trips } from "@/lib/db";
import { buildTimeline } from "@/lib/timeline";
import { toItemDTO, type DocDTO, type ItemDTO } from "@/lib/types";
import { getAirport } from "@/lib/time/airports";

function withCities(i: ItemDTO): ItemDTO {
  if (i.type !== "flight") return i;
  return { ...i, originCity: getAirport(i.origin)?.city ?? null, destinationCity: getAirport(i.destination)?.city ?? null };
}

export async function loadTrip(where: { id: string } | { shareToken: string }) {
  const d = db();
  const [trip] = await d.select().from(trips)
    .where("id" in where ? eq(trips.id, where.id) : eq(trips.shareToken, where.shareToken));
  if (!trip) return null;
  const [rows, docs] = await Promise.all([
    d.select().from(items).where(eq(items.tripId, trip.id)).orderBy(asc(items.startAt)),
    d.select().from(documents).where(eq(documents.tripId, trip.id)).orderBy(desc(documents.createdAt)),
  ]);
  const list = rows.map((r) => withCities(toItemDTO(r)));
  const docList: DocDTO[] = docs.map((x) => ({
    id: x.id, blobUrl: x.blobUrl, mimeType: x.mimeType, fileName: x.fileName, status: x.status, error: x.error,
    createdAt: x.createdAt.toISOString(),
  }));
  return { trip, items: list, documents: docList, timeline: buildTimeline(list) };
}

export type LoadedTrip = NonNullable<Awaited<ReturnType<typeof loadTrip>>>;
