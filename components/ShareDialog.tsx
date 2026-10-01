"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export function ShareDialog({
  tripId, token, showCodes, onClose, onChanged,
}: { tripId: string; token: string | null; showCodes: boolean; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token ? `${location.origin}/share/${token}` : null;

  async function set(enabled: boolean, codes = showCodes) {
    setBusy(true);
    await fetch(`/api/trips/${tripId}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, showCodes: codes }),
    });
    setBusy(false);
    onChanged();
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-ground p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="share-title" className="text-lg font-semibold">Share a read-only link</h2>
          <button type="button" className="btn btn-quiet size-10 justify-center p-0" onClick={onClose} aria-label="Close"><X className="size-5" /></button>
        </div>
        <p className="mt-1 text-sm text-muted">Anyone with the link can see the plan. They can't change it or see your uploaded files.</p>

        {url ? (
          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <input className="input" readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button type="button" className="btn" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={showCodes} disabled={busy} onChange={(e) => set(true, e.target.checked)} />
              Show booking codes and seats
            </label>
            <button type="button" className="btn btn-quiet btn-danger" disabled={busy} onClick={() => set(false)}>Turn off link</button>
          </div>
        ) : (
          <button type="button" className="btn btn-primary mt-4" disabled={busy} onClick={() => set(true)}>Create link</button>
        )}
      </div>
    </div>
  );
}
