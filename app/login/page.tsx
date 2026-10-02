"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import { Logo, ThemePicker } from "@/components/AppNav";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (r.ok) {
      const next = params.get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } else {
      setError((await r.json().catch(() => ({}))).error ?? "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card-body">
      <h2 className="card-title">Sign in</h2>
      <fieldset className="fieldset">
        <legend className="fieldset-legend">Password</legend>
        <label className={`input w-full ${error ? "input-error" : ""}`}>
          <KeyRound className="size-4 opacity-60" aria-hidden />
          <input type="password" autoFocus autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
        </label>
        {error && <p className="label text-error" role="alert">{error}</p>}
      </fieldset>
      <button className="btn btn-primary mt-2" disabled={busy || !password}>
        {busy && <span className="loading loading-spinner loading-sm" />} Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-dvh">
      <div className="navbar px-4 sm:px-6"><div className="flex-1"><Logo /></div><ThemePicker /></div>
      <div className="hero min-h-[80dvh]">
        <div className="hero-content w-full max-w-4xl flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-md text-center lg:text-left">
            <h1 className="wide text-4xl font-extrabold leading-tight sm:text-5xl">Every ticket, in order</h1>
            <p className="mt-4 text-lg text-base-content/70">
              Boarding passes, e-tickets and hotel confirmations become one day-by-day plan, with each flight's recent track record.
            </p>
          </div>
          <div className="card w-full max-w-sm bg-base-100 shadow-xl">
            <Suspense><LoginForm /></Suspense>
          </div>
        </div>
      </div>
    </main>
  );
}
