import { NextResponse } from "next/server";
import { createSessionToken, safeEqual, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  const expected = process.env.APP_PASSWORD;
  if (!expected) return NextResponse.json({ error: "APP_PASSWORD is not set on the server." }, { status: 500 });
  // Small fixed delay slows down guessing.
  await new Promise((r) => setTimeout(r, 400));
  if (!password || !safeEqual(password, expected)) {
    return NextResponse.json({ error: "That password is not right." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  return res;
}
