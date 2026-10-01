import { z } from "zod";
import { ITEM_TYPES } from "./types";
import { isValidZone, localToUtc, resolveZone, DEFAULT_TZ } from "./time/normalise";
import type { NewItem } from "./db/schema";

const opt = z.string().trim().max(500).nullable().optional();

export const ItemInput = z.object({
  type: z.enum(ITEM_TYPES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  startLocal: z.string().nullable().optional(), // "YYYY-MM-DDTHH:mm" in startTz, or null to unschedule
  startTz: opt,
  endLocal: z.string().nullable().optional(),
  endTz: opt,
  origin: opt, destination: opt, address: opt, confirmationCode: opt,
  carrier: opt, number: opt, seat: opt, terminal: opt, gate: opt, notes: z.string().max(2000).nullable().optional(),
  travellers: z.array(z.string().trim().max(100)).nullable().optional(),
});
export type ItemInputT = z.infer<typeof ItemInput>;

/** Convert form input into column values plus the list of fields the user touched (ED-1). */
export function inputToColumns(input: ItemInputT, current?: Partial<NewItem>) {
  const cols: Partial<NewItem> = {};
  const touched = new Set<string>();
  const simple = ["type", "title", "origin", "destination", "address", "confirmationCode", "carrier", "number",
    "seat", "terminal", "gate", "notes", "travellers"] as const;
  for (const k of simple) {
    if (input[k] === undefined) continue;
    let v = input[k] as string | string[] | null;
    if (typeof v === "string") v = v.trim() || null;
    if (k === "carrier" && typeof v === "string") v = v.toUpperCase();
    if ((k === "origin" || k === "destination") && typeof v === "string" && /^[a-z]{3}$/i.test(v)) v = v.toUpperCase();
    (cols as Record<string, unknown>)[k] = v;
    touched.add(k);
  }
  const type = cols.type ?? current?.type ?? "other";
  const origin = cols.origin !== undefined ? cols.origin : current?.origin;
  const destination = cols.destination !== undefined ? cols.destination : current?.destination;

  if (input.startLocal !== undefined) {
    const zone = isValidZone(input.startTz) ? input.startTz
      : resolveZone(type === "flight" ? origin : null, current?.startTz, DEFAULT_TZ);
    const s = input.startLocal ? localToUtc(input.startLocal, zone) : null;
    if (input.startLocal && !s) throw new Error("Start date or time is not valid.");
    cols.startAt = s?.date ?? null;
    cols.startTz = zone;
    touched.add("startAt"); touched.add("startTz");
  }
  if (input.endLocal !== undefined) {
    const zone = isValidZone(input.endTz) ? input.endTz
      : resolveZone(type === "flight" ? destination : null, current?.endTz ?? cols.startTz ?? current?.startTz, DEFAULT_TZ);
    const e = input.endLocal ? localToUtc(input.endLocal, zone) : null;
    if (input.endLocal && !e) throw new Error("End date or time is not valid.");
    cols.endAt = e?.date ?? null;
    cols.endTz = e ? zone : null;
    touched.add("endAt"); touched.add("endTz");
  }
  return { cols, touched: [...touched] };
}
