import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { z } from "zod";
import { db, documents, trips } from "@/lib/db";
import { bad, handle } from "@/lib/api";
import { recomputeTripDates } from "@/lib/trips";

type Ctx = { params: Promise<{ id: string }> };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const Patch = z.object({ title: z.string().trim().min(1).max(120).optional(), startDate: date, endDate: date });

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const b = Patch.parse(await req.json());
    const set: Partial<typeof trips.$inferInsert> = {};
    if (b.title) set.title = b.title;
    if (b.startDate !== undefined || b.endDate !== undefined) {
      set.startDate = b.startDate ?? null;
      set.endDate = b.endDate ?? null;
      set.datesInferred = b.startDate || b.endDate ? "no" : "yes";
    }
    const [trip] = await db().update(trips).set(set).where(eq(trips.id, id)).returning();
    if (!trip) return bad("Trip not found.", 404);
    if (set.datesInferred === "yes") await recomputeTripDates(id);
    return NextResponse.json({ trip });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const d = db();
    const docs = await d.select({ url: documents.blobUrl }).from(documents).where(eq(documents.tripId, id));
    if (docs.length) await del(docs.map((x) => x.url)).catch(() => {});
    await d.delete(trips).where(eq(trips.id, id)); // items and documents cascade
    return NextResponse.json({ ok: true });
  });
}
