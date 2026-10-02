"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  CalendarArrowDown, ChevronLeft, Ellipsis, FileText, Pencil, Plus, Printer, RotateCw, Share2, Trash2, Upload,
} from "lucide-react";
import type { LoadedTrip } from "@/lib/load-trip";
import type { DocDTO, ItemDTO } from "@/lib/types";
import { tripRange } from "@/lib/format";
import { Timeline } from "./Timeline";
import { ItemSheet, type SheetTarget } from "./ItemSheet";
import { Uploader, type UploaderHandle } from "./Uploader";
import { ShareDialog } from "./ShareDialog";
import { AppNav } from "./AppNav";
import { useToast } from "./Toaster";

type Data = Omit<LoadedTrip, "trip"> & { trip: Omit<LoadedTrip["trip"], "createdAt"> & { createdAt: string | Date } };

function tripStats(data: Data) {
  const flights = data.items.filter((i) => i.type === "flight").length;
  let nights = 0;
  const groups = new Map<string, { in?: ItemDTO; out?: ItemDTO }>();
  for (const i of data.items) {
    if (!i.bookingGroup || !i.startAt) continue;
    const g = groups.get(i.bookingGroup) ?? {};
    if (i.type === "hotel_checkin") g.in = i;
    if (i.type === "hotel_checkout") g.out = i;
    groups.set(i.bookingGroup, g);
  }
  for (const g of groups.values()) {
    if (!g.in || !g.out) continue;
    const a = DateTime.fromISO(g.in.startAt!).setZone(g.in.startTz ?? "UTC").startOf("day");
    const b = DateTime.fromISO(g.out.startAt!).setZone(g.out.startTz ?? "UTC").startOf("day");
    nights += Math.max(0, Math.round(b.diff(a, "days").days));
  }
  const cities = new Set(data.timeline.days.flatMap((d) => d.cities)).size;
  const days = data.trip.startDate
    ? Math.round(DateTime.fromISO(data.trip.endDate ?? data.trip.startDate).diff(DateTime.fromISO(data.trip.startDate), "days").days) + 1
    : 0;
  return { days, flights, nights, cities };
}

export function TripView({ initial }: { initial: Data }) {
  const toast = useToast();
  const [data, setData] = useState<Data>(initial);
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const [share, setShare] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const known = useRef(new Set(initial.items.map((i) => i.id)));
  const statuses = useRef(new Map(initial.documents.map((d) => [d.id, d.status])));
  const uploader = useRef<UploaderHandle>(null);
  const tripId = data.trip.id;
  const stats = useMemo(() => tripStats(data), [data]);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/trips/${tripId}/timeline`, { cache: "no-store" });
    if (!r.ok) return;
    const next: Data = await r.json();
    const fresh = next.items.filter((i) => !known.current.has(i.id));
    next.items.forEach((i) => known.current.add(i.id));
    if (fresh.length) setNewIds(new Set(fresh.map((i) => i.id)));

    // Tell the person when a file they were waiting on has been read.
    for (const d of next.documents) {
      const was = statuses.current.get(d.id);
      if (was === "processing" && d.status !== "processing") {
        const added = fresh.filter((i) => i.documentId === d.id).length;
        if (d.status === "done") toast(`${d.fileName ?? "File"}: ${added === 1 ? "1 item added" : `${added} items added`}`);
        else if (d.status === "failed") toast(`${d.fileName ?? "File"} could not be read`, "error");
        else if (d.status === "manual") toast(`No booking found in ${d.fileName ?? "the file"}`, "info");
      }
      statuses.current.set(d.id, d.status);
    }
    setData(next);
  }, [tripId, toast]);

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
    await refresh();
    toast("Trip renamed");
  }

  async function deleteTrip() {
    if (!confirm(`Delete "${data.trip.title}" and all its files? This can't be undone.`)) return;
    await fetch(`/api/trips/${tripId}`, { method: "DELETE" });
    location.href = "/";
  }

  const closeMenu = () => (document.activeElement as HTMLElement | null)?.blur();

  return (
    <>
      <AppNav />
      <div className="mx-auto max-w-3xl px-4 pb-24 sm:px-6">
        <header className="pt-5 pb-6">
          <Link href="/" className="no-print btn btn-ghost btn-sm -ml-3 gap-1 text-base-content/70">
            <ChevronLeft className="size-4" aria-hidden /> All trips
          </Link>
          <div className="mt-2 flex flex-wrap items-start gap-x-4 gap-y-3">
            <div className="mr-auto min-w-0">
              <h1 className="wide text-3xl font-extrabold leading-tight sm:text-4xl">{data.trip.title}</h1>
              <p className="mt-1 text-base-content/70">{tripRange(data.trip.startDate, data.trip.endDate)}</p>
            </div>
            <div className="no-print flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => uploader.current?.openPicker()}><Upload className="size-4" /> Add files</button>
              <button type="button" className="btn" onClick={() => setSheet({ mode: "new" })}><Plus className="size-4" /> Add item</button>
              <div className="dropdown dropdown-end">
                <div tabIndex={0} role="button" className="btn btn-square" aria-label="More actions"><Ellipsis className="size-5" /></div>
                <ul tabIndex={0} className="dropdown-content menu z-30 mt-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl">
                  <li><button type="button" onClick={() => { closeMenu(); setShare(true); }}><Share2 className="size-4" /> Share link</button></li>
                  <li><a href={`/api/trips/${tripId}/export.ics`} onClick={closeMenu}><CalendarArrowDown className="size-4" /> Add to calendar</a></li>
                  <li><button type="button" onClick={() => { closeMenu(); print(); }}><Printer className="size-4" /> Print or save PDF</button></li>
                  <li><button type="button" onClick={() => { closeMenu(); rename(); }}><Pencil className="size-4" /> Rename trip</button></li>
                  <li className="menu-title pt-3">Danger zone</li>
                  <li><button type="button" className="text-error" onClick={() => { closeMenu(); deleteTrip(); }}><Trash2 className="size-4" /> Delete trip</button></li>
                </ul>
              </div>
            </div>
          </div>

          {!empty && (
            <div className="stats mt-5 w-full border border-base-300 bg-base-100">
              <Stat label="Days" value={stats.days || "–"} />
              <Stat label="Flights" value={stats.flights} />
              <Stat label="Nights" value={stats.nights} />
              <Stat label="Cities" value={stats.cities} />
            </div>
          )}
        </header>

        <Uploader ref={uploader} tripId={tripId} onUploaded={refresh} big={empty} />
        <DocumentsStatus docs={data.documents} onChanged={refresh} />

        {!empty && data.items.length === 0 && !processing && (
          <div className="mt-10 text-center text-base-content/70">
            Nothing found in your files yet. Open a file below to check it, or add an item by hand.
          </div>
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
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat px-3 py-3 sm:px-6">
      <div className="stat-title text-xs sm:text-sm">{label}</div>
      <div className="stat-value wide text-2xl sm:text-3xl">{value}</div>
    </div>
  );
}

/** Files still being read, or that need attention, sit above the timeline. */
function DocumentsStatus({ docs, onChanged }: { docs: DocDTO[]; onChanged: () => void }) {
  const active = docs.filter((d) => ["processing", "uploaded", "failed", "manual"].includes(d.status));
  if (!active.length) return null;
  return (
    <ul className="list no-print mt-3 rounded-box border border-base-300 bg-base-100" aria-live="polite">
      {active.map((d) => <DocRow key={d.id} d={d} onChanged={onChanged} />)}
    </ul>
  );
}

function DocRow({ d, onChanged }: { d: DocDTO; onChanged: () => void }) {
  const toast = useToast();
  const reading = d.status === "processing" || d.status === "uploaded";
  const badge = reading ? { t: "Reading", c: "badge-info badge-soft" }
    : d.status === "done" ? { t: "Read", c: "badge-success badge-soft" }
    : d.status === "manual" ? { t: "No booking found", c: "badge-warning badge-soft" }
    : { t: "Could not read", c: "badge-error badge-soft" };
  return (
    <li className="list-row items-center py-2.5">
      {reading ? <span className="loading loading-spinner loading-sm text-info" aria-hidden /> : <FileText className="size-5 text-base-content/50" aria-hidden />}
      <div className="min-w-0">
        <a href={d.blobUrl} target="_blank" rel="noreferrer" className="link link-hover block truncate text-sm font-medium">{d.fileName ?? "File"}</a>
        {d.error && !reading && <p className="text-xs text-base-content/60">{d.error}</p>}
      </div>
      <span className={`badge badge-sm whitespace-nowrap ${badge.c}`}>{badge.t}</span>
      {!reading && (
        <div className="flex">
          <button type="button" className="btn btn-ghost btn-sm btn-square" title="Read again" aria-label="Read again"
            onClick={async () => { await fetch(`/api/documents/${d.id}/reprocess`, { method: "POST" }); toast("Reading the file again", "info"); onChanged(); }}>
            <RotateCw className="size-4" />
          </button>
          <button type="button" className="btn btn-ghost btn-sm btn-square text-error" title="Delete file and its items" aria-label="Delete file"
            onClick={async () => { if (!confirm("Delete this file and the items read from it?")) return; await fetch(`/api/documents/${d.id}`, { method: "DELETE" }); toast("File deleted", "info"); onChanged(); }}>
            <Trash2 className="size-4" />
          </button>
        </div>
      )}
    </li>
  );
}

function AllFiles({ docs, onChanged }: { docs: DocDTO[]; onChanged: () => void }) {
  if (!docs.length) return null;
  return (
    <div className="collapse collapse-arrow no-print mt-12 border border-base-300 bg-base-100">
      <input type="checkbox" aria-label="Show files" />
      <div className="collapse-title font-semibold">Files ({docs.length})</div>
      <div className="collapse-content">
        <ul className="list">{docs.map((d) => <DocRow key={d.id} d={d} onChanged={onChanged} />)}</ul>
      </div>
    </div>
  );
}
