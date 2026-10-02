"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Link2, X } from "lucide-react";
import { useToast } from "./Toaster";

export function ShareDialog({
  tripId, token, showCodes, onClose, onChanged,
}: { tripId: string; token: string | null; showCodes: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = token ? `${location.origin}/share/${token}` : null;
  useEffect(() => { dialog.current?.showModal(); }, []);

  async function set(enabled: boolean, codes = showCodes) {
    setBusy(true);
    await fetch(`/api/trips/${tripId}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled, showCodes: codes }),
    });
    setBusy(false);
    onChanged();
    if (!enabled) toast("Link turned off", "info");
  }

  return (
    <dialog ref={dialog} className="modal modal-bottom sm:modal-middle" onClose={onClose} aria-labelledby="share-title">
      <div className="modal-box">
        <div className="flex items-start justify-between gap-2">
          <h3 id="share-title" className="text-lg font-bold">Share a read-only link</h3>
          <button type="button" className="btn btn-ghost btn-sm btn-circle" onClick={() => dialog.current?.close()} aria-label="Close"><X className="size-5" /></button>
        </div>
        <p className="mt-1 text-sm text-base-content/70">Anyone with the link sees the plan. They can't change it or open your files.</p>

        {url ? (
          <div className="mt-5 space-y-4">
            <div className="join w-full">
              <label className="input join-item w-full">
                <Link2 className="size-4 opacity-60" aria-hidden />
                <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Share link" />
              </label>
              <button type="button" className="btn btn-primary join-item"
                onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); toast("Link copied"); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <label className="label cursor-pointer gap-3 text-base-content">
              <input type="checkbox" className="toggle toggle-primary" checked={showCodes} disabled={busy}
                onChange={(e) => set(true, e.target.checked)} />
              Show booking codes and seats
            </label>
            <div className="modal-action mt-2">
              <button type="button" className="btn btn-ghost text-error" disabled={busy} onClick={() => set(false)}>Turn off link</button>
            </div>
          </div>
        ) : (
          <div className="modal-action">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => set(true)}>
              {busy && <span className="loading loading-spinner loading-sm" />} Create link
            </button>
          </div>
        )}
      </div>
      <form method="dialog" className="modal-backdrop"><button aria-label="Close">close</button></form>
    </dialog>
  );
}
