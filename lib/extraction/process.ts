import { eq, inArray } from "drizzle-orm";
import { db, documents, items } from "@/lib/db";
import type { NewItem } from "@/lib/db/schema";
import { extractFromFile } from "./extract";
import { extractedToItems, matchKey } from "./to-items";
import { recomputeTripDates } from "@/lib/trips";

/** Runs after upload (and on "Read again"). Never throws; failures are stored on the document. */
export async function processDocument(documentId: string) {
  const d = db();
  const [doc] = await d.select().from(documents).where(eq(documents.id, documentId));
  if (!doc) return;
  await d.update(documents).set({ status: "processing", error: null }).where(eq(documents.id, documentId));

  try {
    const res = await fetch(doc.blobUrl);
    if (!res.ok) throw new Error(`Could not download the file (HTTP ${res.status}).`);
    const bytes = await res.arrayBuffer();

    const { data, raw } = await extractFromFile(bytes, doc.mimeType);
    const drafts = extractedToItems(data.items);

    const existing = await d.select().from(items).where(eq(items.documentId, documentId));
    const edited = existing.filter((i) => i.userEdited.length > 0);
    const editedByKey = new Map(edited.map((i) => [matchKey(i), i]));

    // Re-runs replace untouched items; items the user edited keep their edited fields (ED-1).
    const untouchedIds = existing.filter((i) => i.userEdited.length === 0).map((i) => i.id);
    if (untouchedIds.length) await d.delete(items).where(inArray(items.id, untouchedIds));

    const inserts: NewItem[] = [];
    for (const draft of drafts) {
      const prior = editedByKey.get(matchKey(draft));
      if (prior) {
        const patch: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(draft)) {
          if (!prior.userEdited.includes(k) && k !== "bookingGroup") patch[k] = v;
        }
        await d.update(items).set({ ...patch, updatedAt: new Date() }).where(eq(items.id, prior.id));
        editedByKey.delete(matchKey(draft));
      } else {
        inserts.push({ ...draft, tripId: doc.tripId, documentId });
      }
    }
    if (inserts.length) await d.insert(items).values(inserts);

    await d.update(documents)
      .set({ status: drafts.length ? "done" : "manual", rawExtraction: raw,
        error: drafts.length ? null : "No booking found in this file. Add the details by hand." })
      .where(eq(documents.id, documentId));
    await recomputeTripDates(doc.tripId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[extract] failed", { documentId, message });
    await d.update(documents)
      .set({ status: "failed", error: message.slice(0, 500) })
      .where(eq(documents.id, documentId));
  }
}

