import { describe, expect, it } from "vitest";
import { buildTimeline } from "@/lib/timeline";
import type { ItemDTO } from "@/lib/types";

let n = 0;
const item = (p: Partial<ItemDTO>): ItemDTO => ({
  id: `i${++n}`, tripId: "t", documentId: null, bookingGroup: null, type: "other", title: "x",
  startAt: null, startTz: null, endAt: null, endTz: null, origin: null, destination: null, address: null,
  confirmationCode: null, carrier: null, number: null, operatingCarrier: null, operatingNumber: null, seat: null,
  terminal: null, gate: null, travellers: null, notes: null, fieldConfidence: null, userEdited: [], ...p,
});

describe("buildTimeline", () => {
  it("sorts uploads in any order chronologically and groups by local day (TL-1, TL-2)", () => {
    const hotel = item({ type: "hotel_checkin", title: "Check in: Hotel", startAt: "2026-11-14T09:30:00Z", startTz: "Asia/Kolkata", origin: "Delhi" });
    const f1 = item({ type: "flight", origin: "PNQ", destination: "DEL", startAt: "2026-11-14T00:40:00Z", startTz: "Asia/Kolkata", endAt: "2026-11-14T02:55:00Z", endTz: "Asia/Kolkata" });
    const late = item({ type: "restaurant", title: "Dinner", startAt: "2026-11-15T14:30:00Z", startTz: "Asia/Kolkata" });
    const undated = item({ title: "Pass" });
    const t = buildTimeline([late, hotel, undated, f1]);
    expect(t.unscheduled.map((i) => i.id)).toEqual([undated.id]);
    expect(t.days.map((d) => d.date)).toEqual(["2026-11-14", "2026-11-15"]);
    expect(t.days[0].entries.map((e) => e.item.id)).toEqual([f1.id, hotel.id]);
    expect(t.days[0].entries[0].startLocal).toBe("06:10");
    expect(t.days[0].cities).toEqual(["Pune", "New Delhi"]); // hotel "Delhi" is not a new city
  });

  it("marks next-day arrival and short connections (DT-5, TL-4)", () => {
    const a = item({ type: "flight", origin: "PNQ", destination: "DXB", startAt: "2026-11-14T17:00:00Z", startTz: "Asia/Kolkata", endAt: "2026-11-14T20:10:00Z", endTz: "Asia/Dubai" });
    const b = item({ type: "flight", origin: "DXB", destination: "LHR", startAt: "2026-11-14T20:50:00Z", startTz: "Asia/Dubai", endAt: "2026-11-15T04:40:00Z", endTz: "Europe/London" });
    const t = buildTimeline([b, a]);
    const first = t.days[0].entries[0];
    expect(first.endLocal).toBe("00:10");
    expect(first.endDayOffset).toBe(1);
    const second = t.days.flatMap((d) => d.entries).find((e) => e.item.id === b.id)!;
    expect(second.gapBefore).toEqual({ minutes: 40, kind: "layover" });
    expect(second.warning).toMatch(/Tight connection/);
  });

  it("shows a stay on the nights between check-in and check-out", () => {
    const g = "g1";
    const ci = item({ type: "hotel_checkin", title: "Check in: Taj", bookingGroup: g, startAt: "2026-11-14T09:30:00Z", startTz: "Asia/Kolkata" });
    const mid = item({ type: "activity", startAt: "2026-11-15T05:00:00Z", startTz: "Asia/Kolkata" });
    const co = item({ type: "hotel_checkout", title: "Check out: Taj", bookingGroup: g, startAt: "2026-11-16T05:30:00Z", startTz: "Asia/Kolkata" });
    const t = buildTimeline([ci, mid, co]);
    expect(t.days.find((d) => d.date === "2026-11-15")!.staying).toEqual(["Taj"]);
  });
});
