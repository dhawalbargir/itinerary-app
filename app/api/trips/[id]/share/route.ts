import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, trips } from "@/lib/db";
import { bad, handle } from "@/lib/api";

const Body = z.object({ enabled: z.boolean(), showCodes: z.boolean().optional() });

/** SH-1: create, change or revoke the read-only link. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const b = Body.parse(await req.json());
    const d = db();
    const [cur] = await d.select().from(trips).where(eq(trips.id, id));
    if (!cur) return bad("Trip not found.", 404);
    const [trip] = await d.update(trips).set({
      shareToken: b.enabled ? cur.shareToken ?? randomBytes(18).toString("base64url") : null,
      shareShowCodes: b.showCodes ? "yes" : "no",
    }).where(eq(trips.id, id)).returning();
    return NextResponse.json({ trip });
  });
}
