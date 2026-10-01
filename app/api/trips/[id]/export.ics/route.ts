import { bad, handle } from "@/lib/api";
import { loadTrip } from "@/lib/load-trip";
import { toICS } from "@/lib/ics";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const data = await loadTrip({ id });
    if (!data) return bad("Trip not found.", 404);
    const name = data.trip.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "trip";
    return new Response(toICS(data.trip.title, data.items), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.ics"`,
      },
    });
  });
}
