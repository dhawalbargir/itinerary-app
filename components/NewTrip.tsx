"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function NewTrip({ size = "md" }: { size?: "md" | "lg" }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError(null);
    const r = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error ?? "Could not create the trip."); setBusy(false); return; }
    router.push(`/trips/${j.trip.id}`);
  }

  return (
    <>
      <button type="button" className={`btn btn-primary ${size === "lg" ? "btn-lg" : ""}`} onClick={() => dialog.current?.showModal()}>
        <Plus className="size-5" /> New trip
      </button>
      <dialog ref={dialog} className="modal modal-bottom sm:modal-middle">
        <form onSubmit={create} className="modal-box">
          <h3 className="text-lg font-bold">New trip</h3>
          <p className="mt-1 text-sm text-base-content/70">Dates are filled in from the tickets you add.</p>
          <fieldset className="fieldset mt-4">
            <legend className="fieldset-legend">Trip name</legend>
            <input className="input w-full" autoFocus placeholder="Manila, October 2026" value={title}
              onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </fieldset>
          {error && <p className="mt-2 text-sm text-error" role="alert">{error}</p>}
          <div className="modal-action">
            <button type="button" className="btn btn-ghost" onClick={() => dialog.current?.close()}>Cancel</button>
            <button className="btn btn-primary" disabled={busy || !title.trim()}>
              {busy && <span className="loading loading-spinner loading-sm" />} Create trip
            </button>
          </div>
        </form>
        <form method="dialog" className="modal-backdrop"><button aria-label="Close">close</button></form>
      </dialog>
    </>
  );
}
