"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { Camera, Check, LoaderCircle, TriangleAlert, Upload } from "lucide-react";

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 25;
const MAX_EDGE = 2000;

type Row = { key: string; name: string; state: "preparing" | "uploading" | "sent" | "duplicate" | "failed"; error?: string };

export type UploaderHandle = { addFiles: (files: FileList | File[]) => void; openPicker: () => void };

const isHeic = (f: File) => /image\/hei[cf]/.test(f.type) || /\.(heic|heif)$/i.test(f.name);

/** ING-3 and downscaling: HEIC → JPEG, long edge ≤ 2000 px, so every image the model sees is small and supported. */
async function prepare(file: File): Promise<File> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    return file.type ? file : new File([file], file.name, { type: "application/pdf" });
  }
  let blob: Blob = file;
  if (isHeic(file)) {
    const heic2any = (await import("heic2any")).default;
    const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
    blob = Array.isArray(out) ? out[0] : out;
  }
  if (!blob.type.startsWith("image/") && !isHeic(file)) throw new Error("Only images and PDFs can be read.");
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const jpeg = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not convert image."))), "image/jpeg", 0.88));
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([jpeg], name, { type: "image/jpeg" });
}

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const Uploader = forwardRef<UploaderHandle, { tripId: string; onUploaded: () => void; big?: boolean }>(
  function Uploader({ tripId, onUploaded, big }, ref) {
    const [rows, setRows] = useState<Row[]>([]);
    const [over, setOver] = useState(false);
    const pick = useRef<HTMLInputElement>(null);
    const cam = useRef<HTMLInputElement>(null);

    const update = (key: string, patch: Partial<Row>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

    async function one(file: File, key: string) {
      try {
        if (file.size > MAX_BYTES * 2) throw new Error("File is larger than 20 MB.");
        const ready = await prepare(file);
        if (ready.size > MAX_BYTES) throw new Error("File is larger than 20 MB.");
        const hash = await sha256(ready);
        update(key, { state: "uploading" });
        const safe = ready.name.replace(/[^\w.\-]+/g, "_").slice(-80);
        const blob = await upload(`trips/${tripId}/${safe}`, ready, {
          access: "public", handleUploadUrl: "/api/upload", contentType: ready.type,
        });
        const res = await fetch("/api/documents", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, url: blob.url, pathname: blob.pathname, mimeType: ready.type, fileName: file.name, sha256: hash }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j.error ?? "Upload failed.");
        update(key, { state: j.duplicate ? "duplicate" : "sent" });
        onUploaded();
      } catch (e) {
        update(key, { state: "failed", error: e instanceof Error ? e.message : "Upload failed." });
      }
    }

    async function addFiles(list: FileList | File[]) {
      const files = [...list].slice(0, MAX_FILES);
      const batch = files.map((f, i) => ({ key: `${Date.now()}-${i}-${f.name}`, name: f.name, state: "preparing" as const }));
      setRows((r) => [...batch, ...r].slice(0, 40));
      // Three at a time keeps phones responsive.
      let next = 0;
      const worker = async () => { while (next < files.length) { const i = next++; await one(files[i], batch[i].key); } };
      await Promise.all([worker(), worker(), worker()]);
    }

    useImperativeHandle(ref, () => ({ addFiles, openPicker: () => pick.current?.click() }));

    return (
      <div className="no-print">
        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); }}
          className={`rounded-2xl border-2 border-dashed transition-colors ${over ? "border-sign bg-sign/15" : "border-line"} ${big ? "px-6 py-14 text-center" : "px-4 py-4"}`}
        >
          {big ? (
            <>
              <p className="wide text-2xl font-bold">Drop your tickets here</p>
              <p className="mx-auto mt-2 max-w-md text-muted">
                Boarding passes, e-ticket PDFs, hotel and car confirmations, screenshots. Each one is read and placed on the right day.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" className="btn btn-primary" onClick={() => pick.current?.click()}><Upload className="size-4" /> Choose files</button>
                <button type="button" className="btn" onClick={() => cam.current?.click()}><Camera className="size-4" /> Take photo</button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted mr-auto">Drop more files here, or</span>
              <button type="button" className="btn" onClick={() => pick.current?.click()}><Upload className="size-4" /> Choose files</button>
              <button type="button" className="btn" onClick={() => cam.current?.click()}><Camera className="size-4" /> Take photo</button>
            </div>
          )}
          <input ref={pick} type="file" multiple hidden accept="image/*,application/pdf,.heic,.heif,.pdf"
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={cam} type="file" hidden accept="image/*" capture="environment"
            onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {rows.some((r) => r.state !== "sent") && (
          <ul className="mt-3 space-y-1 text-sm" aria-live="polite">
            {rows.filter((r) => r.state !== "sent").map((r) => (
              <li key={r.key} className="flex items-center gap-2">
                {r.state === "failed" ? <TriangleAlert className="size-4 text-bad" aria-hidden />
                  : r.state === "duplicate" ? <Check className="size-4 text-muted" aria-hidden />
                  : <LoaderCircle className="size-4 animate-spin text-muted" aria-hidden />}
                <span className="truncate">{r.name}</span>
                <span className={`ml-auto shrink-0 ${r.state === "failed" ? "text-bad" : "text-muted"}`}>
                  {r.state === "preparing" ? "Preparing" : r.state === "uploading" ? "Uploading"
                    : r.state === "duplicate" ? "Already in this trip" : r.error}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
