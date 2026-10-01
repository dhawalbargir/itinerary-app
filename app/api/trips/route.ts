import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { db, trips } from "@/lib/db";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const rows = await db().select().from(trips).orderBy(desc(trips.startDate), desc(trips.createdAt));
    return NextResponse.json({ trips: rows });
  });
}

const Body = z.object({
  title: z.string().trim().min(1).max(120),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export async function POST(req: Request) {
  return handle(async () => {
    const b = Body.parse(await req.json());
    const given = !!(b.startDate || b.endDate);
    const [trip] = await db().insert(trips).values({
      title: b.title, startDate: b.startDate ?? null, endDate: b.endDate ?? null, datesInferred: given ? "no" : "yes",
    }).returning();
    return NextResponse.json({ trip });
  });
}
