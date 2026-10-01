"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

export function NewTrip({ prominent }: { prominent?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!prominent);
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

  if (!open) {
    return <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="size-4" /> New trip</button>;
  }
  return (
    <form onSubmit={create} className="flex w-full flex-wrap items-end gap-2">
      <label className="field flex-1 min-w-56">
        <span>Trip name</span>
        <input className="input" autoFocus placeholder="Goa with family, Nov 2026" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </label>
      <button className="btn btn-primary" disabled={busy || !title.trim()}>
        {busy && <LoaderCircle className="size-4 animate-spin" />} Create trip
      </button>
      {error && <p className="w-full text-sm text-bad" role="alert">{error}</p>}
    </form>
  );
}
