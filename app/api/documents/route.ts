import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, documents, trips } from "@/lib/db";
import { processDocument } from "@/lib/extraction/process";
import { putFile } from "@/lib/blob";
import { bad, handle } from "@/lib/api";

export const maxDuration = 300;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
// Vercel functions accept request bodies up to 4.5 MB.
const MAX_BYTES = 4.4 * 1024 * 1024;

/** Upload a file through the server (multipart form: tripId, file), store it in Blob, start reading it. */
export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData().catch(() => null);
    if (!form) return bad("Send the file as a form upload.");
    const tripId = String(form.get("tripId") ?? "");
    const file = form.get("file");
    if (!/^[0-9a-f-]{36}$/i.test(tripId)) return bad("Missing trip.");
    if (!(file instanceof File)) return bad("No file was sent.");
    if (!ALLOWED.includes(file.type)) return bad("Only JPG, PNG, WebP and PDF files can be read.");
    if (file.size > MAX_BYTES) return bad("File is larger than 4 MB. Try a screenshot of the ticket, or a smaller PDF.");

    const d = db();
    const [trip] = await d.select({ id: trips.id }).from(trips).where(eq(trips.id, tripId));
    if (!trip) return bad("Trip not found.", 404);

    // ING-4: skip a file already in this trip (checked before storing anything).
    const bytes = await file.arrayBuffer();
    const sha256 = createHash("sha256").update(Buffer.from(bytes)).digest("hex");
    const [dupe] = await d.select().from(documents).where(and(eq(documents.tripId, tripId), eq(documents.sha256, sha256)));
    if (dupe) return NextResponse.json({ document: { id: dupe.id }, duplicate: true });

    const safe = (file.name || "upload").replace(/[^\w.\-]+/g, "_").slice(-80);
    const stored = await putFile(`trips/${tripId}/${safe}`, new Blob([bytes], { type: file.type }), file.type);

    const [doc] = await d.insert(documents).values({
      tripId, blobUrl: stored.url, blobPath: stored.pathname, blobAccess: stored.access,
      mimeType: file.type, fileName: file.name, sha256,
      status: "processing", processingStartedAt: new Date(),
    }).returning({ id: documents.id });

    after(() => processDocument(doc.id));
    return NextResponse.json({ document: doc, duplicate: false });
  });
}
