"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarArrowDown, ChevronLeft, FileText, LoaderCircle, Plus, Printer, RotateCw, Share2, Trash2, Upload } from "lucide-react";
import type { LoadedTrip } from "@/lib/load-trip";
import type { DocDTO, ItemDTO } from "@/lib/types";
import { tripRange } from "@/lib/format";
import { Timeline } from "./Timeline";
import { ItemSheet, type SheetTarget } from "./ItemSheet";
import { Uploader, type UploaderHandle } from "./Uploader";
import { ShareDialog } from "./ShareDialog";

type Data = Omit<LoadedTrip, "trip"> & { trip: Omit<LoadedTrip["trip"], "createdAt"> & { createdAt: string | Date } };

export function TripView({ initial }: { initial: Data }) {
  const [data, setData] = useState<Data>(initial);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [share, setShare] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const known = useRef(new Set(initial.items.map((i) => i.id)));
  const uploader = useRef<UploaderHandle>(null);
  const tripId = data.trip.id;

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/trips/${tripId}/timeline`, { cache: "no-store" });
    if (!r.ok) return;
    const next: Data = await r.json();
    const fresh = next.items.filter((i) => !known.current.has(i.id)).map((i) => i.id);
    next.items.forEach((i) => known.current.add(i.id));
    if (fresh.length) setNewIds(new Set(fresh));
    setData(next);
  }, [tripId]);

  const processing = data.documents.some((d) => d.status === "processing" || d.status === "uploaded");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [processing, refresh]);

  // Drop files anywhere on the page.
  useEffect(() => {
    const over = (e: DragEvent) => { if (e.dataTransfer?.types.includes("Files")) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer?.files.length) return;
      e.preventDefault();
      uploader.current?.addFiles(e.dataTransfer.files);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragover", over); window.removeEventListener("drop", drop); };
  }, []);

  const empty = data.items.length === 0 && data.documents.length === 0;

  async function rename() {
    const title = prompt("Trip name", data.trip.title)?.trim();
    if (!title || title === data.trip.title) return;
    await fetch(`/api/trips/${tripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    refresh();
  }

  async function deleteTrip() {
    if (!confirm(`Delete "${data.trip.title}" and all its files? This can't be undone.`)) return;
    await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    location.href = "/";
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-24">
      <header className="pt-5 pb-6">
        <Link href="/" className="no-print inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ChevronLeft className="size-4" aria-hidden /> All trips
        </Link>
        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
          <div className="min-w-0 mr-auto">
            <h1 className="wide text-3xl sm:text-4xl font-extrabold leading-tight">
              <button type="button" onClick={rename} className="text-left hover:underline decoration-sign decoration-4 underline-offset-4" title="Rename trip">
                {data.trip.title}
              </button>
            </h1>
            <p className="mt-1 text-muted">{tripRange(data.trip.startDate, data.trip.endDate)}</p>
          </div>
          <div className="no-print flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => uploader.current?.openPicker()}><Upload className="size-4" /> Add files</button>
            <button type="button" className="btn" onClick={() => setSheet({ mode: "new" })}><Plus className="size-4" /> Add item</button>
            <button type="button" className="btn" onClick={() => setShare(true)} aria-label="Share"><Share2 className="size-4" /><span className="hidden sm:inline">Share</span></button>
            <a className="btn" href={`/api/trips/${tripId}/export.ics`} aria-label="Add to calendar"><CalendarArrowDown className="size-4" /><span className="hidden sm:inline">Calendar</span></a>
            <button type="button" className="btn" onClick={() => print()} aria-label="Print or save as PDF"><Printer className="size-4" /></button>
          </div>
        </div>
      </header>

      <Uploader ref={uploader} tripId={tripId} onUploaded={refresh} big={empty} />

      <DocumentsStatus docs={data.documents} onChanged={refresh} />

      {!empty && data.items.length === 0 && !processing && (
        <p className="mt-10 text-center text-muted">Nothing found in your files yet. Open a file below to add its details, or add an item by hand.</p>
      )}

      <div className="mt-8">
        <Timeline
          timeline={data.timeline}
          newIds={newIds}
          onOpen={(item: ItemDTO) => setSheet({ mode: "edit", item })}
          onDropOnDay={(id, date) => {
            const item = data.items.find((i) => i.id === id);
            if (item) setSheet({ mode: "edit", item, presetDate: date });
          }}
        />
      </div>

      <AllFiles docs={data.documents} onChanged={refresh} />

      <div className="no-print mt-16 border-t border-line pt-4">
        <button type="button" className="btn btn-quiet btn-danger" onClick={deleteTrip}><Trash2 className="size-4" /> Delete trip</button>
      </div>

      {sheet && (
        <ItemSheet
          key={sheet.mode === "edit" ? sheet.item.id + (sheet.presetDate ?? "") : "new"}
          target={sheet}
          tripId={tripId}
          documents={data.documents}
          onClose={() => setSheet(null)}
          onChanged={refresh}
        />
      )}
      {share && (
        <ShareDialog tripId={tripId} token={data.trip.shareToken} showCodes={data.trip.shareShowCodes === "yes"}
          onClose={() => setShare(false)} onChanged={refresh} />
      )}
    </div>
  );
}

/** Files still being read, or that need attention, sit above the timeline. */
function DocumentsStatus({ docs, onChanged }: { docs: DocDTO[]; onChanged: () => void }) {
  const active = docs.filter((d) => d.status === "processing" || d.status === "uploaded" || d.status === "failed" || d.status === "manual");
  if (!active.length) return null;
  return (
    <ul className="no-print mt-4 space-y-2" aria-live="polite">
      {active.map((d) => <DocRow key={d.id} d={d} onChanged={onChanged} />)}
    </ul>
  );
}

function DocRow({ d, onChanged }: { d: DocDTO; onChanged: () => void }) {
  const reading = d.status === "processing" || d.status === "uploaded";
  return (
    <li className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm ${d.status === "failed" ? "border-bad/40 bg-bad-bg" : d.status === "manual" ? "border-warn/40 bg-warn-bg" : "border-line bg-surface"}`}>
      {reading ? <LoaderCircle className="size-4 shrink-0 animate-spin text-muted" aria-hidden /> : <FileText className="size-4 shrink-0 text-muted" aria-hidden />}
      <span className="min-w-0">
        <a href={d.blobUrl} target="_blank" rel="noreferrer" className="block truncate hover:underline">{d.fileName ?? "File"}</a>
        {d.error && !reading && <span className="block text-xs text-muted">{d.error}</span>}
      </span>
      <span className={`ml-auto shrink-0 ${d.status === "failed" ? "text-bad" : d.status === "manual" ? "text-warn" : "text-muted"}`}>
        {reading ? "Reading…" : d.status === "done" ? "Read" : d.status === "manual" ? "No booking found" : "Could not read"}
      </span>
      {!reading && <DocActions d={d} onChanged={onChanged} />}
    </li>
  );
}

function DocActions({ d, onChanged }: { d: DocDTO; onChanged: () => void }) {
  return (
    <span className="flex shrink-0 gap-1">
      <button type="button" className="btn btn-quiet h-8 px-2" title="Read again" aria-label="Read again"
        onClick={async () => { await fetch(`/api/documents/${d.id}/reprocess`, { method: "POST" }); onChanged(); }}>
        <RotateCw className="size-4" />
      </button>
      <button type="button" className="btn btn-quiet btn-danger h-8 px-2" title="Delete file and its items" aria-label="Delete file"
        onClick={async () => { if (!confirm("Delete this file and the items read from it?")) return; await fetch(`/api/documents/${d.id}`, { method: "DELETE" }); onChanged(); }}>
        <Trash2 className="size-4" />
      </button>
    </span>
  );
}

function AllFiles({ docs, onChanged }: { docs: DocDTO[]; onChanged: () => void }) {
  if (!docs.length) return null;
  return (
    <details className="no-print mt-12">
      <summary className="cursor-pointer font-semibold">Files ({docs.length})</summary>
      <ul className="mt-3 space-y-2">{docs.map((d) => <DocRow key={d.id} d={d} onChanged={onChanged} />)}</ul>
    </details>
  );
}
