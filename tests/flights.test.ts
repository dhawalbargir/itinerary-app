import { describe, expect, it } from "vitest";
import { normaliseFlightNo, parseFlightNo } from "@/lib/flights/normalise";
import { summarise, type HistoryDay } from "@/lib/flights/summary";
import { historyDates } from "@/lib/flights/history";
import { mapFlight } from "@/lib/flights/aerodatabox";

const day = (status: HistoryDay["status"], delay: number | null, date = "2026-09-01"): HistoryDay => ({
  date, status, arrDelayMin: delay, schedDep: null, actualDep: null, schedArr: null, actualArr: null, depTz: null, arrTz: null, aircraft: null,
});

describe("flight numbers", () => {
  it("normalises", () => {
    expect(normaliseFlightNo("ai", " 0131")).toBe("AI131");
    expect(parseFlightNo("6E 2134")).toBe("6E2134");
    expect(normaliseFlightNo(null, "1")).toBeNull();
  });
});

describe("history window", () => {
  it("future trip uses the last 7 completed days", () => {
    expect(historyDates("2026-11-14", "2026-10-01", 3)).toEqual(["2026-09-30", "2026-09-29", "2026-09-28"]);
  });
  it("past trip includes the booked date and the days before it", () => {
    expect(historyDates("2026-09-20", "2026-10-01", 2)).toEqual(["2026-09-20", "2026-09-19", "2026-09-18"]);
  });
  it("travel day shows the previous days (live status is separate)", () => {
    expect(historyDates("2026-10-01", "2026-10-01", 2)).toEqual(["2026-09-30", "2026-09-29"]);
  });
});

describe("summary", () => {
  it("counts on-time, cancellations and median delay", () => {
    const s = summarise([day("on_time", 5), day("on_time", -3), day("delayed", 40), day("cancelled", null), day("not_scheduled", null)]);
    expect(s).toEqual({ operated: 4, onTime: 2, cancelled: 1, medianDelay: 5, rating: "poor" });
    expect(summarise([day("on_time", 0), day("on_time", 10)]).rating).toBe("good");
  });
});

describe("AeroDataBox mapping", () => {
  it("computes arrival delay and status", () => {
    const d = mapFlight({
      status: "Arrived",
      departure: { airport: { iata: "PNQ", timeZone: "Asia/Kolkata" }, scheduledTime: { utc: "2026-09-30 00:40Z" }, revisedTime: { utc: "2026-09-30 01:05Z" } },
      arrival: { airport: { iata: "DEL", timeZone: "Asia/Kolkata" }, scheduledTime: { utc: "2026-09-30 02:55Z" }, revisedTime: { utc: "2026-09-30 03:17Z" } },
      aircraft: { model: "Airbus A320" },
    }, true);
    expect(d.arrDelayMin).toBe(22);
    expect(d.status).toBe("delayed");
    expect(d.depIata).toBe("PNQ");
  });
  it("maps cancellations", () => {
    expect(mapFlight({ status: "Canceled" }, true).status).toBe("cancelled");
  });
});
