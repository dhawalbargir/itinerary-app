import { NextResponse, after } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, documents, trips } from "@/lib/db";
import { processDocument } from "@/lib/extraction/process";
import { bad, handle } from "@/lib/api";

export const maxDuration = 300;

const Body = z.object({
  tripId: z.string().uuid(),
  url: z.string().url(),
  pathname: z.string().optional(),
  mimeType: z.string(),
  fileName: z.string().max(300).optional(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const host = new URL(b.url).hostname;
    if (!host.endsWith(".blob.vercel-storage.com")) return bad("Files must be uploaded through the app.");
    const d = db();
    const [trip] = await d.select({ id: trips.id }).from(trips).where(eq(trips.id, b.tripId));
    if (!trip) return bad("Trip not found.", 404);

    // ING-4: skip a file already in this trip.
    const [dupe] = await d.select().from(documents).where(and(eq(documents.tripId, b.tripId), eq(documents.sha256, b.sha256)));
    if (dupe) return NextResponse.json({ document: dupe, duplicate: true });

    const [doc] = await d.insert(documents).values({
      tripId: b.tripId, blobUrl: b.url, blobPath: b.pathname, mimeType: b.mimeType, fileName: b.fileName, sha256: b.sha256,
      status: "processing",
    }).returning();

    after(() => processDocument(doc.id));
    return NextResponse.json({ document: doc, duplicate: false });
  });
}
