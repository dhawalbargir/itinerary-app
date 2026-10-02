import { eq } from "drizzle-orm";
import { db, documents } from "@/lib/db";
import { readFile } from "@/lib/blob";
import { bad, handle } from "@/lib/api";

/** Serves an uploaded file to the signed-in owner (middleware checks the session). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    if (!/^[0-9a-f-]{36}$/i.test(id)) return bad("Not found.", 404);
    const [doc] = await db().select().from(documents).where(eq(documents.id, id));
    if (!doc) return bad("Not found.", 404);
    const file = await readFile(doc.blobUrl, doc.blobAccess);
    const name = (doc.fileName ?? "document").replace(/[^\w.\- ]+/g, "_");
    return new Response(file.stream, {
      headers: {
        "Content-Type": file.contentType || doc.mimeType,
        "Content-Disposition": `inline; filename="${name}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
