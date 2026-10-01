"use client";

import { LogOut } from "lucide-react";

export function SignOut() {
  return (
    <button type="button" className="btn btn-quiet" onClick={async () => { await fetch("/api/logout", { method: "POST" }); location.href = "/login"; }}>
      <LogOut className="size-4" /> Sign out
    </button>
  );
}
