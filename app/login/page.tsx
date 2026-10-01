"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";

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
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <label className="field">
        <span>Password</span>
        <input className="input" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      {error && <p className="text-sm font-medium text-bad" role="alert">{error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={busy || !password}>
        {busy && <LoaderCircle className="size-4 animate-spin" />} Sign in
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-16">
      <h1 className="wide text-5xl sm:text-6xl font-extrabold leading-[0.95]">Itinerary</h1>
      <p className="mt-3 mb-10 max-w-md text-lg text-muted">Your tickets and confirmations, in the order you'll use them.</p>
      <Suspense><LoginForm /></Suspense>
    </main>
  );
}
