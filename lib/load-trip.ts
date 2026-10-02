import { and, asc, desc, eq, inArray } from "drizzle-orm";
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

  // A file "Reading…" for over 6 minutes has died (timeout or crash): mark it failed so it can be retried.
  const STALE_MS = 6 * 60 * 1000;
  const stale = docs.filter((x) => x.status === "processing"
    && Date.now() - (x.processingStartedAt ?? x.createdAt).getTime() > STALE_MS);
  if (stale.length) {
    const msg = "Reading took too long and was stopped. Use Read again.";
    await d.update(documents).set({ status: "failed", error: msg })
      .where(and(inArray(documents.id, stale.map((x) => x.id)), eq(documents.status, "processing")));
    for (const x of stale) { x.status = "failed"; x.error = msg; }
  }
  const docList: DocDTO[] = docs.map((x) => ({
    id: x.id, blobUrl: `/api/files/${x.id}`, mimeType: x.mimeType, fileName: x.fileName, status: x.status, error: x.error,
    createdAt: x.createdAt.toISOString(),
  }));
  return { trip, items: list, documents: docList, timeline: buildTimeline(list) };
}

export type LoadedTrip = NonNullable<Awaited<ReturnType<typeof loadTrip>>>;
