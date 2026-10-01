import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, items } from "@/lib/db";
import { bad, handle } from "@/lib/api";
import { ItemInput, inputToColumns } from "@/lib/item-input";
import { recomputeTripDates } from "@/lib/trips";
import { toItemDTO } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const input = ItemInput.parse(await req.json());
    const d = db();
    const [cur] = await d.select().from(items).where(eq(items.id, id));
    if (!cur) return bad("Item not found.", 404);
    const { cols, touched } = inputToColumns(input, cur);
    const userEdited = [...new Set([...cur.userEdited, ...touched])];
    const [item] = await d.update(items).set({ ...cols, userEdited, updatedAt: new Date() })
      .where(eq(items.id, id)).returning();
    await recomputeTripDates(cur.tripId);
    return NextResponse.json({ item: toItemDTO(item) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const [item] = await db().delete(items).where(eq(items.id, id)).returning();
    if (!item) return bad("Item not found.", 404);
    await recomputeTripDates(item.tripId);
    return NextResponse.json({ ok: true });
  });
}
