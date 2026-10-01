import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { del } from "@vercel/blob";
import { db, documents, items } from "@/lib/db";
import { bad, handle } from "@/lib/api";
import { recomputeTripDates } from "@/lib/trips";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const d = db();
    const [doc] = await d.select().from(documents).where(eq(documents.id, id));
    if (!doc) return bad("Document not found.", 404);
    await d.delete(items).where(eq(items.documentId, id));
    await d.delete(documents).where(eq(documents.id, id));
    await del(doc.blobUrl).catch(() => {});
    await recomputeTripDates(doc.tripId);
    return NextResponse.json({ ok: true });
  });
}
