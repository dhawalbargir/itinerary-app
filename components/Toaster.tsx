"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";

type Kind = "success" | "error" | "info";
type Toast = { id: number; kind: Kind; text: string };
const Ctx = createContext<(text: string, kind?: Kind) => void>(() => {});

/** Short confirmations ("Saved", "2 items added") in daisyUI's toast slot. */
export function Toaster({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Kind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 3500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toast toast-end toast-bottom z-50 no-print" aria-live="polite">
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CircleCheck : t.kind === "error" ? CircleAlert : Info;
          return (
            <div key={t.id} role="status" className={`alert alert-soft shadow-lg ${t.kind === "success" ? "alert-success" : t.kind === "error" ? "alert-error" : "alert-info"}`}>
              <Icon className="size-5" aria-hidden />
              <span className="max-w-72">{t.text}</span>
              <button type="button" className="btn btn-ghost btn-xs btn-circle" aria-label="Dismiss"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}>
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
