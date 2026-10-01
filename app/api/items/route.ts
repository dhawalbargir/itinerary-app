import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, items, trips } from "@/lib/db";
import { bad, handle } from "@/lib/api";
import { ItemInput, inputToColumns } from "@/lib/item-input";
import { recomputeTripDates } from "@/lib/trips";
import { toItemDTO } from "@/lib/types";

const Body = ItemInput.extend({ tripId: z.string().uuid(), title: z.string().trim().min(1).max(200) });

/** ED-2: an item typed in by hand, no document. */
export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const [trip] = await db().select({ id: trips.id }).from(trips).where(eq(trips.id, b.tripId));
    if (!trip) return bad("Trip not found.", 404);
    const { cols } = inputToColumns(b);
    const [item] = await db().insert(items).values({
      ...cols, tripId: b.tripId, type: b.type ?? "other", title: b.title, userEdited: ["*"],
    }).returning();
    await recomputeTripDates(b.tripId);
    return NextResponse.json({ item: toItemDTO(item) });
  });
}
