import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { loadTrip } from "@/lib/load-trip";
import { tripRange } from "@/lib/format";
import { SharedTimeline } from "@/components/SharedTimeline";
import { AppNav } from "@/components/AppNav";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[\w-]{16,64}$/.test(token)) notFound();
  const data = await loadTrip({ shareToken: token });
  if (!data) notFound();
  const showCodes = data.trip.shareShowCodes === "yes";

  // Strip private fields before anything reaches the browser.
  const timeline = JSON.parse(JSON.stringify(data.timeline, (k, v) => {
    if (["documentId", "fieldConfidence", "userEdited", "notes"].includes(k)) return undefined;
    if (!showCodes && ["confirmationCode", "seat", "travellers"].includes(k)) return null;
    return v;
  }));

  return (
    <>
      <AppNav signedIn={false} />
      <main className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <header className="py-8">
          <span className="badge badge-ghost mb-3">Shared itinerary</span>
          <h1 className="wide text-3xl font-extrabold sm:text-4xl">{data.trip.title}</h1>
          <p className="mt-1 text-base-content/70">{tripRange(data.trip.startDate, data.trip.endDate)}</p>
        </header>
        <SharedTimeline timeline={timeline} showCodes={showCodes} />
      </main>
    </>
  );
}
