import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { db, documents } from "@/lib/db";
import { processDocument } from "@/lib/extraction/process";
import { bad, handle } from "@/lib/api";

export const maxDuration = 300;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const [doc] = await db().update(documents).set({ status: "processing", error: null })
      .where(eq(documents.id, id)).returning();
    if (!doc) return bad("Document not found.", 404);
    after(() => processDocument(id));
    return NextResponse.json({ ok: true });
  });
}
