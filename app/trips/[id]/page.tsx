import { notFound } from "next/navigation";
import { loadTrip } from "@/lib/load-trip";
import { TripView } from "@/components/TripView";

export const dynamic = "force-dynamic";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await loadTrip({ id });
  if (!data) notFound();
  return <TripView initial={JSON.parse(JSON.stringify(data))} />;
}
