import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handle(fn: () => Promise<Response>) {
  return fn().catch((err: unknown) => {
    if (err instanceof ZodError) return bad(err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    const message = err instanceof Error ? err.message : "Something went wrong.";
    console.error("[api]", message);
    return bad(message, 500);
  });
}
