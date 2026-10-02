"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, RotateCw, Trash2, TriangleAlert, X } from "lucide-react";
import type { DocDTO, ItemDTO } from "@/lib/types";
import { ITEM_TYPES, TYPE_LABEL } from "@/lib/types";
import { toInputValue } from "@/lib/format";
import { confToField, needsCheck } from "./ItemCard";
import { FlightHistory } from "./FlightHistory";
import { useToast } from "./Toaster";
import { TypeIcon } from "./icons";

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
type Tab = "details" | "document" | "history";

export function ItemSheet({
  target, tripId, documents, onClose, onChanged,
}: {
  target: SheetTarget; tripId: string; documents: DocDTO[];
  onClose: () => void; onChanged: () => Promise<void> | void;
}) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const item = target.mode === "edit" ? target.item : null;
  const initial = useMemo(() => toForm(item), [item]);
  const [form, setForm] = useState<Form>(() => {
    const f = toForm(item);
    if (target.mode === "edit" && target.presetDate) f.startLocal = `${target.presetDate}T${f.startLocal.slice(11) || "09:00"}`;
    return f;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("details");
  const doc = item?.documentId ? documents.find((d) => d.id === item.documentId) : undefined;
  const isFlight = form.type === "flight";
  const showHistory = !!item && item.type === "flight";

  useEffect(() => { dialog.current?.showModal(); }, []);

  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"); } catch { return []; }
  }, []);

  const flagged = (field: string) => {
    if (!item || item.userEdited.includes(field)) return false;
    return Object.entries(item.fieldConfidence ?? {}).some(([k, v]) => v < 0.7 && confToField(k) === field);
  };
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!form.title.trim()) { setError("Give the item a title."); return; }
    setBusy("save"); setError(null);
    const body: Record<string, unknown> = {};
    for (const k of Object.keys(form) as (keyof Form)[]) {
      if (target.mode === "new" || form[k] !== initial[k]) body[k] = form[k] === "" ? null : form[k];
    }
    // Times travel with their zones; a changed airport re-derives that end's zone on the server.
    if ("startTz" in body || "startLocal" in body) { body.startLocal = form.startLocal || null; body.startTz = form.startTz || null; }
    if ("endTz" in body || "endLocal" in body) { body.endLocal = form.endLocal || null; body.endTz = form.endTz || null; }
    if (isFlight && form.origin !== initial.origin && form.startTz === initial.startTz) { body.startLocal = form.startLocal || null; body.startTz = null; }
    if (isFlight && form.destination !== initial.destination && form.endTz === initial.endTz) { body.endLocal = form.endLocal || null; body.endTz = null; }
    if (!isFlight && body.startLocal && !body.startTz) body.startTz = DEFAULT_TZ;
    if (target.mode === "new") body.tripId = tripId;

    const res = await fetch(target.mode === "new" ? "/api/items" : `/api/items/${item!.id}`, {
      method: target.mode === "new" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setError(j.error ?? "Could not save."); setTab("details"); return; }
    await onChanged();
    toast(target.mode === "new" ? "Item added" : "Changes saved");
    onClose();
  }

  async function remove() {
    if (!item || !confirm(`Delete "${item.title}"?`)) return;
    setBusy("delete");
    await fetch(`/api/items/${item.id}`, { method: "DELETE" });
    await onChanged();
    toast("Item deleted", "info");
    onClose();
  }

  async function reprocess() {
    if (!doc) return;
    setBusy("reprocess");
    await fetch(`/api/documents/${doc.id}/reprocess`, { method: "POST" });
    await onChanged();
    toast("Reading the document again. Your edits are kept.", "info");
    onClose();
  }

  const field = (k: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, f: string = k) => (
    <fieldset className="fieldset min-w-0 py-0">
      <legend className="fieldset-legend">{label}</legend>
      <input className={`input w-full ${flagged(f) ? "input-warning" : ""}`} value={form[k]} onChange={set(k)} {...props} />
      {flagged(f) && <p className="label whitespace-normal text-warning">Check this</p>}
    </fieldset>
  );

  return (
    <dialog ref={dialog} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby="sheet-title">
      <div className="modal-box flex max-h-[92dvh] w-full flex-col p-0 sm:max-w-3xl">
        <div className="flex items-center gap-3 border-b border-base-300 px-5 py-4">
          <span className={`grid size-9 shrink-0 place-items-center rounded-full ${isFlight ? "bg-primary text-primary-content" : "bg-base-200"}`}>
            <TypeIcon type={form.type} className="size-4" />
          </span>
          <h2 id="sheet-title" className="min-w-0 flex-1 truncate text-lg font-bold">
            {target.mode === "new" ? "Add an item" : item!.title}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => dialog.current?.close()} aria-label="Close"><X className="size-5" /></button>
        </div>

        {(doc || showHistory) && (
          <div role="tablist" className="tabs tabs-border px-3">
            <button type="button" role="tab" className={`tab ${tab === "details" ? "tab-active" : ""}`} aria-selected={tab === "details"} onClick={() => setTab("details")}>Details</button>
            {doc && <button type="button" role="tab" className={`tab ${tab === "document" ? "tab-active" : ""}`} aria-selected={tab === "document"} onClick={() => setTab("document")}>Document</button>}
            {showHistory && <button type="button" role="tab" className={`tab ${tab === "history" ? "tab-active" : ""}`} aria-selected={tab === "history"} onClick={() => setTab("history")}>Track record</button>}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === "details" && (
            <form id="item-form" onSubmit={save} className="space-y-4">
              {item && needsCheck(item) && (
                <div role="alert" className="alert alert-warning alert-soft text-sm">
                  <TriangleAlert className="size-5" aria-hidden />
                  <span>Highlighted fields were hard to read.{doc ? " Compare them with the Document tab." : ""}</span>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
                <fieldset className="fieldset py-0">
                  <legend className="fieldset-legend">Type</legend>
                  <select className="select w-full" value={form.type} onChange={set("type")}>
                    {ITEM_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </fieldset>
                {field("title", "Title", { required: true })}
              </div>

              {isFlight && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {field("carrier", "Airline code", { placeholder: "CX", maxLength: 3 })}
                  {field("number", "Flight number", { placeholder: "919", inputMode: "numeric" })}
                  {field("origin", "From airport", { placeholder: "HKG", maxLength: 3 })}
                  {field("destination", "To airport", { placeholder: "MNL", maxLength: 3 })}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {field("startLocal", isFlight ? "Departs, local time" : form.type === "hotel_checkin" ? "Check-in from, local time" : "Starts, local time", { type: "datetime-local" }, "startAt")}
                {field("startTz", "Time zone", { list: "zones", placeholder: isFlight ? "From the airport" : DEFAULT_TZ })}
                {field("endLocal", isFlight ? "Lands, local time" : "Ends, local time", { type: "datetime-local" }, "endAt")}
                {field("endTz", "Time zone", { list: "zones", placeholder: isFlight ? "From the airport" : "Same as start" })}
                <datalist id="zones">{zones.map((z) => <option key={z} value={z} />)}</datalist>
              </div>
              {isFlight && <p className="-mt-2 text-xs text-base-content/60">Leave time zones empty for flights; they come from the airports.</p>}

              {!isFlight && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {field("origin", "City or place")}
                  {field("destination", "Destination, if any")}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {field("confirmationCode", "Booking code")}
                {field("seat", "Seat")}
                {field("terminal", "Terminal")}
                {field("gate", "Gate")}
              </div>
              {field("address", "Address")}
              <fieldset className="fieldset py-0">
                <legend className="fieldset-legend">Notes</legend>
                <textarea className="textarea w-full" rows={3} value={form.notes} onChange={set("notes")} />
              </fieldset>
              {error && <div role="alert" className="alert alert-error alert-soft text-sm">{error}</div>}
            </form>
          )}

          {tab === "document" && doc && <DocPreview doc={doc} />}
          {tab === "history" && item && (
            <FlightHistory itemId={item.id} refreshKey={`${item.carrier}${item.number}${item.origin}${item.startAt}`} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-base-300 px-5 py-3">
          {item && (
            <button type="button" className="btn btn-ghost btn-sm text-error" onClick={remove} disabled={!!busy}>
              <Trash2 className="size-4" /> Delete
            </button>
          )}
          {doc && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={reprocess} disabled={!!busy} title="Your edits are kept">
              <RotateCw className="size-4" /> Read again
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={() => save()} disabled={!!busy}>
              {busy === "save" && <span className="loading loading-spinner loading-sm" />}
              {target.mode === "new" ? "Add item" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop"><button aria-label="Close">close</button></form>
    </dialog>
  );
}

function DocPreview({ doc }: { doc: DocDTO }) {
  if (doc.mimeType === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-box border border-base-300">
        <object data={doc.blobUrl} type="application/pdf" className="h-[65dvh] w-full">
          <a className="link link-primary flex items-center gap-2 p-4" href={doc.blobUrl} target="_blank" rel="noreferrer">
            <FileText className="size-4" /> Open {doc.fileName ?? "PDF"}
          </a>
        </object>
      </div>
    );
  }
  return (
    <a href={doc.blobUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-box border border-base-300 bg-base-200">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={doc.blobUrl} alt={doc.fileName ?? "Uploaded document"} className="mx-auto max-h-[65dvh] object-contain" />
    </a>
  );
}
