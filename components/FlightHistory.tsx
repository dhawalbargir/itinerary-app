"use client";

import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Radio } from "lucide-react";
import { DateTime } from "luxon";
import type { HistoryDay, Summary } from "@/lib/flights/summary";
import { hm } from "@/lib/format";

type Resp = {
  configured: boolean; flightNo: string; depIata: string; today: string; bookedDate: string; marketed: string | null;
  days: HistoryDay[]; live: HistoryDay | null; summary: Summary; limited: boolean;
  error?: string; incomplete?: boolean;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  on_time: { label: "On time", cls: "bg-good-bg text-good" },
  delayed: { label: "Delayed", cls: "bg-warn-bg text-warn" },
  cancelled: { label: "Cancelled", cls: "bg-bad-bg text-bad" },
  diverted: { label: "Diverted", cls: "bg-bad-bg text-bad" },
  not_scheduled: { label: "Not scheduled", cls: "text-muted" },
  scheduled: { label: "Scheduled", cls: "text-muted" },
  unknown: { label: "No data", cls: "text-muted" },
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

  return (
    <section aria-labelledby="track" className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h3 id="track" className="font-semibold">
          Track record{data?.flightNo ? <span className="wide ml-2">{data.flightNo}</span> : null}
        </h3>
        {loading && <LoaderCircle className="size-4 animate-spin text-muted" aria-label="Loading" />}
      </div>

      {data?.error ? (
        <p className="px-4 py-3 text-sm text-muted">{data.error}</p>
      ) : data && !data.configured ? (
        <p className="px-4 py-3 text-sm text-muted">
          Flight history is off. Add <code className="font-semibold">AERODATABOX_API_KEY</code> in your Vercel project settings and redeploy.
        </p>
      ) : data ? (
        <div className="px-4 py-3 space-y-3">
          {data.marketed && (
            <p className="text-xs text-muted">Sold as {data.marketed}; showing the operating flight.</p>
          )}
          {data.live && <LiveBanner d={data.live} />}
          <SummaryLine s={data.summary} n={data.days.filter((d) => d.date < data.today).length} />
          {data.limited && <p className="text-sm text-warn">Daily flight-data limit reached; some days are missing.</p>}
          <div className="overflow-x-auto -mx-4">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="px-4 py-1.5 font-medium">Date</th>
                  <th className="py-1.5 font-medium">Departed</th>
                  <th className="py-1.5 font-medium">Arrived</th>
                  <th className="py-1.5 font-medium text-right">Delay</th>
                  <th className="px-4 py-1.5 font-medium">Status</th>
                  <th className="pr-4 py-1.5 font-medium">Aircraft</th>
                </tr>
              </thead>
              <tbody>
                {data.days.map((d) => {
                  const st = STATUS[d.status] ?? STATUS.unknown;
                  const booked = d.date === data.bookedDate;
                  return (
                    <tr key={d.date} className={`border-t border-line ${booked ? "bg-sign/15" : ""}`}>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {DateTime.fromISO(d.date).toFormat("ccc d LLL")}
                        {booked && <span className="ml-1 text-xs font-semibold">your flight</span>}
                      </td>
                      <td className="py-2 whitespace-nowrap"><Times sched={d.schedDep} actual={d.actualDep} tz={d.depTz} /></td>
                      <td className="py-2 whitespace-nowrap"><Times sched={d.schedArr} actual={d.actualArr} tz={d.arrTz} /></td>
                      <td className="py-2 text-right whitespace-nowrap wide font-semibold">
                        {d.arrDelayMin == null ? "–" : d.arrDelayMin <= 0 ? `${d.arrDelayMin}` : `+${d.arrDelayMin}`}
                      </td>
                      <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span></td>
                      <td className="pr-4 py-2 text-muted whitespace-nowrap">{d.aircraft ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Delay is arrival delay in minutes; 15 or more counts as late.</span>
            <button type="button" className="btn btn-quiet h-8 text-xs" onClick={() => setDays(days === 7 ? 14 : 7)}>
              {days === 7 ? "Show 14 days" : "Show 7 days"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Times({ sched, actual, tz }: { sched: string | null; actual: string | null; tz: string | null }) {
  if (!sched && !actual) return <span className="text-muted">–</span>;
  return (
    <span>
      <span className="wide font-semibold">{hm(actual ?? sched, tz)}</span>
      {actual && sched && hm(actual, tz) !== hm(sched, tz) && (
        <span className="ml-1 text-xs text-muted line-through">{hm(sched, tz)}</span>
      )}
    </span>
  );
}

function SummaryLine({ s, n }: { s: Summary; n: number }) {
  if (!s.operated) return <p className="text-sm text-muted">No completed flights to compare yet.</p>;
  const tone = s.rating === "good" ? "text-good" : s.rating === "fair" ? "text-warn" : "text-bad";
  return (
    <p className="text-sm">
      <span className={`font-bold ${tone}`}>On time {s.onTime} of {s.operated} days.</span>
      {s.medianDelay != null && <> Median arrival delay {s.medianDelay} min.</>}
      {s.cancelled ? ` ${s.cancelled} cancelled.` : " None cancelled."}
      <span className="text-muted"> Last {n} days.</span>
    </p>
  );
}

function LiveBanner({ d }: { d: HistoryDay }) {
  const st = STATUS[d.status] ?? STATUS.unknown;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-sign/25 px-3 py-2 text-sm">
      <span className="flex items-center gap-1.5 font-semibold"><Radio className="size-4" aria-hidden /> Today</span>
      <span>Departs <Times sched={d.schedDep} actual={d.actualDep} tz={d.depTz} /></span>
      <span>Arrives <Times sched={d.schedArr} actual={d.actualArr} tz={d.arrTz} /></span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
    </div>
  );
}
