export type DayStatus =
  | "on_time" | "delayed" | "cancelled" | "diverted" | "not_scheduled" | "scheduled" | "unknown";

export type HistoryDay = {
  date: string;
  status: DayStatus;
  schedDep: string | null;
  actualDep: string | null;
  schedArr: string | null;
  actualArr: string | null;
  depTz: string | null;
  arrTz: string | null;
  arrDelayMin: number | null;
  aircraft: string | null;
};

export const LATE_THRESHOLD_MIN = 15;

export function statusFromDelay(delay: number | null): DayStatus {
  if (delay == null) return "unknown";
  return delay >= LATE_THRESHOLD_MIN ? "delayed" : "on_time";
}

export type Summary = {
  operated: number;
  onTime: number;
  cancelled: number;
  medianDelay: number | null;
  rating: "good" | "fair" | "poor" | "none";
};

export function summarise(days: HistoryDay[]): Summary {
  const flown = days.filter((d) => d.status === "on_time" || d.status === "delayed" || d.status === "diverted");
  const cancelled = days.filter((d) => d.status === "cancelled").length;
  const onTime = days.filter((d) => d.status === "on_time").length;
  const operated = flown.length + cancelled;
  const delays = flown.map((d) => d.arrDelayMin).filter((x): x is number => x != null).sort((a, b) => a - b);
  const medianDelay = delays.length
    ? delays.length % 2
      ? delays[(delays.length - 1) / 2]
      : Math.round((delays[delays.length / 2 - 1] + delays[delays.length / 2]) / 2)
    : null;
  let rating: Summary["rating"] = "none";
  if (operated) {
    const share = onTime / operated;
    rating = cancelled > 0 || share < 0.5 ? "poor" : share < 0.8 ? "fair" : "good";
  }
  return { operated, onTime, cancelled, medianDelay, rating };
}
