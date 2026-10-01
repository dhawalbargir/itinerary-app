"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, LoaderCircle, RotateCw, Trash2, X } from "lucide-react";
import type { DocDTO, ItemDTO } from "@/lib/types";
import { ITEM_TYPES, TYPE_LABEL } from "@/lib/types";
import { toInputValue } from "@/lib/format";
import { confToField } from "./ItemCard";
import { FlightHistory } from "./FlightHistory";

type Form = {
  type: string; title: string; startLocal: string; startTz: string; endLocal: string; endTz: string;
  origin: string; destination: string; carrier: string; number: string; confirmationCode: string;
  seat: string; terminal: string; gate: string; address: string; notes: string;
};

const DEFAULT_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

function toForm(i: Partial<ItemDTO> | null): Form {
  return {
    type: i?.type ?? "activity", title: i?.title ?? "",
    startLocal: i?.startAt ? toInputValue(i.startAt, i.startTz) : "", startTz: i?.startTz ?? "",
    endLocal: i?.endAt ? toInputValue(i.endAt, i.endTz) : "", endTz: i?.endTz ?? "",
    origin: i?.origin ?? "", destination: i?.destination ?? "", carrier: i?.carrier ?? "", number: i?.number ?? "",
    confirmationCode: i?.confirmationCode ?? "", seat: i?.seat ?? "", terminal: i?.terminal ?? "", gate: i?.gate ?? "",
    address: i?.address ?? "", notes: i?.notes ?? "",
  };
}

export type SheetTarget = { mode: "edit"; item: ItemDTO; presetDate?: string } | { mode: "new" };

export function ItemSheet({
  target, tripId, documents, onClose, onChanged,
}: {
  target: SheetTarget; tripId: string; documents: DocDTO[];
  onClose: () => void; onChanged: () => Promise<void> | void;
}) {
  const item = target.mode === "edit" ? target.item : null;
  const initial = useMemo(() => toForm(item), [item]);
  const [form, setForm] = useState<Form>(() => {
    const f = toForm(item);
    if (target.mode === "edit" && target.presetDate) f.startLocal = `${target.presetDate}T${f.startLocal.slice(11) || "09:00"}`;
    return f;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const doc = item?.documentId ? documents.find((d) => d.id === item.documentId) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"); } catch { return []; }
  }, []);

  const flagged = (field: string) => {
    if (!item) return false;
    if (item.userEdited.includes(field)) return false;
    return Object.entries(item.fieldConfidence ?? {}).some(([k, v]) => v < 0.7 && confToField(k) === field);
  };

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    setBusy("save"); setError(null);
    const body: Record<string, unknown> = {};
    const keys = Object.keys(form) as (keyof Form)[];
    for (const k of keys) {
      if (target.mode === "new" || form[k] !== initial[k]) body[k] = form[k] === "" ? null : form[k];
    }
    // Times and their zones travel together.
    if ("startTz" in body || "startLocal" in body) { body.startLocal = form.startLocal || null; body.startTz = form.startTz || null; }
    if ("endTz" in body || "endLocal" in body) { body.endLocal = form.endLocal || null; body.endTz = form.endTz || null; }
    // Flights: a changed airport re-derives that end's zone on the server.
    if (isFlight && form.origin !== initial.origin && form.startTz === initial.startTz) { body.startLocal = form.startLocal || null; body.startTz = null; }
    if (isFlight && form.destination !== initial.destination && form.endTz === initial.endTz) { body.endLocal = form.endLocal || null; body.endTz = null; }
    if (!isFlight && body.startLocal && !body.startTz) body.startTz = DEFAULT_TZ;
    if (target.mode === "new") body.tripId = tripId;
    if (!form.title.trim()) { setError("Give the item a title."); setBusy(null); return; }

    const res = await fetch(target.mode === "new" ? "/api/items" : `/api/items/${item!.id}`, {
      method: target.mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? "Could not save."); return; }
    await onChanged();
    onClose();
  }

  async function remove() {
    if (!item || !confirm(`Delete "${item.title}"?`)) return;
    setBusy("delete");
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    await onChanged();
    onClose();
  }

  async function reprocess() {
    if (!doc) return;
    setBusy("reprocess");
    await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
    await onChanged();
    onClose();
  }

  const isFlight = form.type === "flight";
  const input = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, field: string = k) => (
    <label className="field">
      <span>{label}</span>
      <input className={`input ${flagged(field) ? "flagged" : ""}`} value={form[k]} onChange={set(k)} {...props} />
    </label>
  );

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/40" role="dialog" aria-modal="true" aria-labelledby="sheet-title" onClick={onClose}>
      <div
        className={`h-full w-full overflow-y-auto bg-ground shadow-2xl ${doc ? "max-w-5xl" : "max-w-xl"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-line bg-ground px-5 py-3">
          <h2 id="sheet-title" className="font-semibold truncate">{target.mode === "new" ? "Add an item" : item!.title}</h2>
          <button type="button" className="btn btn-quiet size-10 justify-center p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>

        <div className={`grid gap-6 p-5 ${doc ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          {doc && (
            <div className="lg:sticky lg:top-20 self-start">
              <DocPreview doc={doc} />
            </div>
          )}

          <div className="space-y-5">
            {item && Object.values(item.fieldConfidence ?? {}).some((v) => v < 0.7) && (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
                Highlighted fields were hard to read. Compare them with the document and fix anything wrong.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="field">
                <span>Type</span>
                <select className="input" value={form.type} onChange={set("type")}>
                  {ITEM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                </select>
              </label>
              {input("title", "Title", { required: true })}
            </div>

            {isFlight && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {input("carrier", "Airline code", { placeholder: "AI", maxLength: 3 })}
                {input("number", "Flight number", { placeholder: "850", inputMode: "numeric" })}
                {input("origin", "From (airport)", { placeholder: "PNQ", maxLength: 3 })}
                {input("destination", "To (airport)", { placeholder: "DEL", maxLength: 3 })}
              </div>
            )}

            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Times</legend>
              {input("startLocal", isFlight ? "Departs (local time)" : "Starts (local time)", { type: "datetime-local" }, "startAt")}
              {input("startTz", "Time zone", { list: "zones", placeholder: isFlight ? "From the airport" : DEFAULT_TZ })}
              {input("endLocal", isFlight ? "Arrives (local time)" : "Ends (local time)", { type: "datetime-local" }, "endAt")}
              {input("endTz", "Time zone", { list: "zones", placeholder: isFlight ? "From the airport" : "Same as start" })}
              <datalist id="zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
            </fieldset>
            {isFlight && <p className="-mt-3 text-xs text-muted">Leave time zone empty for flights; it comes from the airports.</p>}

            {!isFlight && (
              <div className="grid gap-3 sm:grid-cols-2">
                {input("origin", "City or place")}
                {input("destination", "Destination (if any)")}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {input("confirmationCode", "Booking code")}
              {input("seat", "Seat")}
              {input("terminal", "Terminal")}
              {input("gate", "Gate")}
            </div>
            {input("address", "Address")}
            <label className="field">
              <span>Notes</span>
              <textarea className="input" rows={3} value={form.notes} onChange={set("notes")} />
            </label>

            {error && <p className="text-sm font-medium text-bad" role="alert">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary" onClick={save} disabled={!!busy}>
                {busy === "save" && <LoaderCircle className="size-4 animate-spin" />}
                {target.mode === "new" ? "Add item" : "Save changes"}
              </button>
              {doc && (
                <button type="button" className="btn" onClick={reprocess} disabled={!!busy} title="Your edits are kept">
                  <RotateCw className="size-4" /> Read document again
                </button>
              )}
              {item && (
                <button type="button" className="btn btn-quiet btn-danger ml-auto" onClick={remove} disabled={!!busy}>
                  <Trash2 className="size-4" /> Delete item
                </button>
              )}
            </div>

            {item && item.type === "flight" && (
              <FlightHistory itemId={item.id} refreshKey={`${item.carrier}${item.number}${item.origin}${item.startAt}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocPreview({ doc }: { doc: DocDTO }) {
  if (doc.mimeType === "application/pdf") {
    return (
      <div className="rounded-xl border border-line bg-surface overflow-hidden">
        <object data={doc.blobUrl} type="application/pdf" className="h-[75vh] w-full">
          <a className="flex items-center gap-2 p-4 text-teal underline" href={doc.blobUrl} target="_blank" rel="noreferrer">
            <FileText className="size-4" /> Open {doc.fileName ?? "PDF"}
          </a>
        </object>
      </div>
    );
  }
  return (
    <a href={doc.blobUrl} target="_blank" rel="noreferrer" className="block rounded-xl border border-line bg-surface overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={doc.blobUrl} alt={doc.fileName ?? "Uploaded document"} className="w-full max-h-[75vh] object-contain" />
    </a>
  );
}
