"use client";

import { useCallback, useEffect, useState } from "react";
import { Radio } from "lucide-react";
import { DateTime } from "luxon";
import type { HistoryDay, Summary } from "@/lib/flights/summary";
import { hm } from "@/lib/format";

type Resp = {
  configured: boolean; flightNo: string; depIata: string; today: string; bookedDate: string; marketed: string | null;
  days: HistoryDay[]; live: HistoryDay | null; summary: Summary; limited: boolean;
  error?: string; incomplete?: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  on_time: { label: "On time", cls: "badge-success" },
  delayed: { label: "Delayed", cls: "badge-warning" },
  cancelled: { label: "Cancelled", cls: "badge-error" },
  diverted: { label: "Diverted", cls: "badge-error" },
  not_scheduled: { label: "Not scheduled", cls: "badge-ghost" },
  scheduled: { label: "Scheduled", cls: "badge-ghost" },
  unknown: { label: "No data", cls: "badge-ghost" },
};

export function FlightHistory({ itemId, refreshKey }: { itemId: string; refreshKey: string }) {
  const [days, setDays] = useState<7 | 14>(7);
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/flights/history?itemId=${itemId}&days=${days}`);
      setData(await r.json());
    } catch {
      setData({ error: "Could not reach the server." } as Resp);
    } finally {
      setLoading(false);
    }
  }, [itemId, days]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // On the day of travel, refresh live status every 5 minutes while open.
  useEffect(() => {
    if (!data?.live) return;
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [data?.live, load]);

  if (loading && !data) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="skeleton h-20 w-full" /><div className="skeleton h-40 w-full" />
      </div>
    );
  }
  if (!data) return null;
  if (data.error) return <div role="alert" className="alert alert-soft">{data.error}</div>;
  if (!data.configured) {
    return (
      <div role="alert" className="alert alert-info alert-soft">
        <span>Flight history is off. Add <code className="font-semibold">AERODATABOX_API_KEY</code> in your Vercel project settings and redeploy.</span>
      </div>
    );
  }

  const past = data.days.filter((d) => d.date < data.today).length;
  const s = data.summary;
  const pct = s.operated ? Math.round((s.onTime / s.operated) * 100) : null;
  const tone = s.rating === "good" ? "text-success" : s.rating === "fair" ? "text-warning" : s.rating === "poor" ? "text-error" : "";

  return (
    <div className="space-y-4">
      {data.marketed && <p className="text-sm text-base-content/60">Sold as {data.marketed}; showing the operating flight {data.flightNo}.</p>}

      {data.live && (
        <div role="status" className="alert alert-info alert-soft">
          <Radio className="size-5" aria-hidden />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold">Today</span>
            <span>Departs <Times sched={data.live.schedDep} actual={data.live.actualDep} tz={data.live.depTz} /></span>
            <span>Lands <Times sched={data.live.schedArr} actual={data.live.actualArr} tz={data.live.arrTz} /></span>
            <span className={`badge badge-sm ${(STATUS[data.live.status] ?? STATUS.unknown).cls}`}>{(STATUS[data.live.status] ?? STATUS.unknown).label}</span>
          </div>
        </div>
      )}

      {s.operated ? (
        <div className="stats stats-vertical w-full border border-base-300 bg-base-100 sm:stats-horizontal">
          <div className="stat">
            <div className="stat-title">On time</div>
            <div className={`stat-value wide ${tone}`}>{pct}%</div>
            <div className="stat-desc">{s.onTime} of {s.operated} days</div>
          </div>
          <div className="stat">
            <div className="stat-title">Median arrival delay</div>
            <div className="stat-value wide">{s.medianDelay ?? "–"}<span className="text-base font-semibold"> min</span></div>
            <div className="stat-desc">Late means 15 min or more</div>
          </div>
          <div className="stat">
            <div className="stat-title">Cancelled</div>
            <div className={`stat-value wide ${s.cancelled ? "text-error" : ""}`}>{s.cancelled}</div>
            <div className="stat-desc">Last {past} days</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-base-content/60">No completed flights to compare yet.</p>
      )}

      {data.limited && <div role="alert" className="alert alert-warning alert-soft text-sm">Daily flight-data limit reached; some days are missing.</div>}

      <div className="overflow-x-auto rounded-box border border-base-300 bg-base-100">
        <table className="table table-zebra table-sm min-w-[34rem]">
          <thead>
            <tr><th>Date</th><th>Departed</th><th>Landed</th><th className="text-right">Delay</th><th>Status</th><th>Aircraft</th></tr>
          </thead>
          <tbody>
            {data.days.map((d) => {
              const st = STATUS[d.status] ?? STATUS.unknown;
              const booked = d.date === data.bookedDate;
              return (
                <tr key={d.date} className={booked ? "!bg-secondary/20" : ""}>
                  <td className="whitespace-nowrap">
                    {DateTime.fromISO(d.date).toFormat("ccc d LLL")}
                    {booked && <span className="badge badge-secondary badge-xs ml-1.5">yours</span>}
                  </td>
                  <td className="whitespace-nowrap"><Times sched={d.schedDep} actual={d.actualDep} tz={d.depTz} /></td>
                  <td className="whitespace-nowrap"><Times sched={d.schedArr} actual={d.actualArr} tz={d.arrTz} /></td>
                  <td className="wide whitespace-nowrap text-right font-semibold">
                    {d.arrDelayMin == null ? "–" : d.arrDelayMin <= 0 ? `${d.arrDelayMin}` : `+${d.arrDelayMin}`}
                  </td>
                  <td><span className={`badge badge-soft badge-sm ${st.cls}`}>{st.label}</span></td>
                  <td className="whitespace-nowrap text-base-content/60">{d.aircraft ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-base-content/60">Times are local. Delay is arrival delay in minutes.</span>
        <div className="join">
          <button type="button" className={`btn btn-xs join-item ${days === 7 ? "btn-active" : ""}`} onClick={() => setDays(7)}>7 days</button>
          <button type="button" className={`btn btn-xs join-item ${days === 14 ? "btn-active" : ""}`} onClick={() => setDays(14)}>14 days</button>
        </div>
      </div>
      {loading && <progress className="progress progress-primary w-full" />}
    </div>
  );
}

function Times({ sched, actual, tz }: { sched: string | null; actual: string | null; tz: string | null }) {
  if (!sched && !actual) return <span className="text-base-content/50">–</span>;
  return (
    <span>
      <span className="wide font-semibold">{hm(actual ?? sched, tz)}</span>
      {actual && sched && hm(actual, tz) !== hm(sched, tz) && (
        <span className="ml-1 text-xs text-base-content/50 line-through">{hm(sched, tz)}</span>
      )}
    </span>
  );
}
