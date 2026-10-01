import { NextResponse } from "next/server";
import { bad, handle } from "@/lib/api";
import { loadTrip } from "@/lib/load-trip";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const data = await loadTrip({ id });
    if (!data) return bad("Trip not found.", 404);
    return NextResponse.json(data);
  });
}
