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

describe("check-in after arrival", () => {
  // The reported case: BOM → HKG → MNL, hotel in Pasay opens at 14:00 but CX 919 lands 16:30.
  const cx660 = item({ type: "flight", carrier: "CX", number: "660", origin: "BOM", destination: "HKG",
    originCity: "Mumbai", destinationCity: "Hong Kong",
    startAt: "2026-10-05T20:10:00Z", startTz: "Asia/Kolkata", endAt: "2026-10-06T02:10:00Z", endTz: "Asia/Hong_Kong" });
  const cx919 = item({ type: "flight", carrier: "CX", number: "919", origin: "HKG", destination: "MNL",
    originCity: "Hong Kong", destinationCity: "Manila",
    startAt: "2026-10-06T06:05:00Z", startTz: "Asia/Hong_Kong", endAt: "2026-10-06T08:30:00Z", endTz: "Asia/Manila" });
  const hotel = item({ type: "hotel_checkin", title: "Check in: Microtel Mall of Asia", origin: "Pasay",
    bookingGroup: "h", startAt: "2026-10-06T06:00:00Z", startTz: "Asia/Manila" });

  it("places the check-in after the flight that lands there", () => {
    const t = buildTimeline([hotel, cx919, cx660]);
    const order = t.days.flatMap((d) => d.entries.map((e) => e.item.id));
    expect(order).toEqual([cx660.id, cx919.id, hotel.id]);
    const h = t.days.flatMap((d) => d.entries).find((e) => e.item.id === hotel.id)!;
    expect(h.startLocal).toBe("14:00");         // still shows the real check-in time
    expect(h.afterArrival).toBe(true);
    expect(h.warning).toBeNull();
    const second = t.days.flatMap((d) => d.entries).find((e) => e.item.id === cx919.id)!;
    expect(second.gapBefore).toEqual({ minutes: 235, kind: "layover" });
    expect(t.days[0].cities).toEqual(["Mumbai", "Hong Kong", "Manila"]);
  });

  it("leaves a check-in alone when you are already there", () => {
    const local = item({ type: "flight", origin: "MNL", destination: "CEB", originCity: "Manila", destinationCity: "Cebu",
      startAt: "2026-10-07T10:00:00Z", startTz: "Asia/Manila", endAt: "2026-10-07T11:20:00Z", endTz: "Asia/Manila" });
    const manilaHotel = item({ type: "hotel_checkin", title: "Check in: Manila Hotel", origin: "Manila",
      startAt: "2026-10-07T06:00:00Z", startTz: "Asia/Manila" });
    const t = buildTimeline([local, manilaHotel]);
    expect(t.days[0].entries.map((e) => e.item.id)).toEqual([manilaHotel.id, local.id]);
  });

  it("moves a domestic check-in after a same-zone flight into that city", () => {
    const toGoa = item({ type: "flight", origin: "DEL", destination: "GOI", originCity: "New Delhi", destinationCity: "Goa",
      startAt: "2026-10-07T08:00:00Z", startTz: "Asia/Kolkata", endAt: "2026-10-07T10:30:00Z", endTz: "Asia/Kolkata" });
    const goaHotel = item({ type: "hotel_checkin", title: "Check in: Taj", origin: "Goa",
      startAt: "2026-10-07T08:30:00Z", startTz: "Asia/Kolkata" });
    const t = buildTimeline([goaHotel, toGoa]);
    expect(t.days[0].entries.map((e) => e.item.id)).toEqual([toGoa.id, goaHotel.id]);
  });
});
