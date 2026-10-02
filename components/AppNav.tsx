"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, LogOut, Palette } from "lucide-react";
import { THEMES } from "@/lib/themes";

export function Logo() {
  return (
    <span className="flex items-center gap-2">
      <svg viewBox="0 0 64 64" className="size-7" aria-hidden>
        <rect width="64" height="64" rx="16" className="fill-primary" />
        <rect x="14" y="16" width="36" height="8" rx="3" className="fill-secondary" />
        <rect x="14" y="30" width="26" height="6" rx="3" className="fill-primary-content" />
        <rect x="14" y="42" width="30" height="6" rx="3" className="fill-primary-content" opacity=".7" />
      </svg>
      <span className="wide text-lg font-extrabold">Itinerary</span>
    </span>
  );
}

export function ThemePicker() {
  const [theme, setTheme] = useState<string | null>(null);
  useEffect(() => { setTheme(document.documentElement.getAttribute("data-theme")); }, []);
  function choose(id: string | null) {
    if (id) document.documentElement.setAttribute("data-theme", id);
    else document.documentElement.removeAttribute("data-theme");
    try { if (id) localStorage.setItem("theme", id); else localStorage.removeItem("theme"); } catch {}
    setTheme(id);
    (document.activeElement as HTMLElement | null)?.blur();
  }
  return (
    <div className="dropdown dropdown-end">
      <div tabIndex={0} role="button" className="btn btn-ghost btn-sm gap-1.5" aria-label="Theme">
        <Palette className="size-4" /><span className="hidden sm:inline">Theme</span>
      </div>
      <ul tabIndex={0} className="dropdown-content menu z-30 mt-2 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-xl">
        <li><button type="button" onClick={() => choose(null)}>
          Match my device {theme === null && <Check className="ml-auto size-4" />}
        </button></li>
        {THEMES.map((t) => (
          <li key={t.id}>
            <button type="button" onClick={() => choose(t.id)} data-theme={t.id} className="bg-base-100 text-base-content my-0.5">
              <span className="flex gap-1">
                <span className="size-2.5 rounded-full bg-primary" /><span className="size-2.5 rounded-full bg-secondary" /><span className="size-2.5 rounded-full bg-accent" />
              </span>
              {t.label}
              {theme === t.id && <Check className="ml-auto size-4" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppNav({ signedIn = true }: { signedIn?: boolean }) {
  return (
    <header className="navbar sticky top-0 z-20 border-b border-base-300 bg-base-100/90 px-3 backdrop-blur no-print sm:px-6">
      <div className="flex-1">
        {signedIn ? <Link href="/" aria-label="All trips"><Logo /></Link> : <Logo />}
      </div>
      <div className="flex items-center gap-1">
        <ThemePicker />
        {signedIn && (
          <button type="button" className="btn btn-ghost btn-sm gap-1.5"
            onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}>
            <LogOut className="size-4" /><span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </div>
    </header>
  );
}
