import { describe, expect, it } from "vitest";
import { localToUtc, resolveZone } from "@/lib/time/normalise";
import { extractedToItems } from "@/lib/extraction/to-items";

describe("time zones (DT-1, DT-2)", () => {
  it("resolves airports to their zone", () => {
    expect(resolveZone("PNQ", null)).toBe("Asia/Kolkata");
    expect(resolveZone("lhr", null)).toBe("Europe/London");
  });
  it("falls back to the hint, then the default", () => {
    expect(resolveZone(null, "Europe/Paris")).toBe("Europe/Paris");
    expect(resolveZone("Somewhere", "Not/AZone", "UTC")).toBe("UTC");
  });
  it("converts local wall time to UTC", () => {
    expect(localToUtc("2026-11-14T06:10", "Asia/Kolkata")!.date.toISOString()).toBe("2026-11-14T00:40:00.000Z");
  });
  it("infers a missing year as the next occurrence (DT-4)", () => {
    const now = new Date("2026-10-01T00:00:00Z");
    expect(localToUtc("--11-14T06:10", "Asia/Kolkata", { now })!.date.toISOString()).toBe("2026-11-14T00:40:00.000Z");
    expect(localToUtc("--02-03T10:00", "UTC", { now })!.date.toISOString()).toBe("2027-02-03T10:00:00.000Z");
  });
});

describe("extracted items", () => {
  it("handles an overnight flight with arrival in another zone (DT-5)", () => {
    const [f] = extractedToItems([{
      type: "flight", title: "Pune → London", start_local: "2026-11-14T22:30", start_place: "PNQ",
      end_local: "2026-11-15T04:15", end_place: "LHR", carrier: "ai", number: "0131",
    }]);
    expect(f.startTz).toBe("Asia/Kolkata");
    expect(f.endTz).toBe("Europe/London");
    expect(f.carrier).toBe("AI");
    expect(f.number).toBe("131");
    expect((f.endAt as Date).toISOString()).toBe("2026-11-15T04:15:00.000Z");
  });

  it("splits a hotel into linked check-in and check-out (TL-3)", () => {
    const list = extractedToItems([{
      type: "hotel", title: "Taj Exotica", start_local: "2026-11-15", end_local: "2026-11-18",
      start_place: "Goa", start_tz: "Asia/Kolkata",
    }]);
    expect(list.map((i) => i.type)).toEqual(["hotel_checkin", "hotel_checkout"]);
    expect(list[0].bookingGroup).toBe(list[1].bookingGroup);
    expect((list[0].startAt as Date).toISOString()).toBe("2026-11-15T09:30:00.000Z"); // 15:00 IST
    expect((list[1].startAt as Date).toISOString()).toBe("2026-11-18T05:30:00.000Z"); // 11:00 IST
  });

  it("keeps undated items unscheduled", () => {
    const [i] = extractedToItems([{ type: "activity", title: "Museum pass" }]);
    expect(i.startAt).toBeNull();
  });
});
