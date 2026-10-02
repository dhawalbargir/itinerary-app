"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import type { ItemDTO } from "@/lib/types";
import { TYPE_LABEL } from "@/lib/types";
import { durationLabel } from "@/lib/format";
import { TypeIcon } from "./icons";

export type CardEntry = {
  item: ItemDTO;
  startLocal: string;
  endLocal: string | null;
  endDayOffset: number;
  afterArrival?: boolean;
};

export function confToField(k: string) {
  const map: Record<string, string> = {
    start_local: "startAt", end_local: "endAt", start_place: "origin", end_place: "destination",
    confirmation_code: "confirmationCode", operating_carrier: "operatingCarrier", operating_number: "operatingNumber",
  };
  return map[k] ?? k;
}

export const needsCheck = (i: ItemDTO) =>
  Object.entries(i.fieldConfidence ?? {}).some(([k, v]) => v < 0.7 && !i.userEdited.includes(confToField(k)));

export function ItemCard({
  entry, onOpen, readOnly, showCodes = true, isNew,
}: { entry: CardEntry; onOpen?: () => void; readOnly?: boolean; showCodes?: boolean; isNew?: boolean }) {
  const { item } = entry;
  const flagged = !readOnly && needsCheck(item);
  const body = item.type === "flight"
    ? <FlightBody entry={entry} showCodes={showCodes} badge={!readOnly} />
    : <PlainBody entry={entry} showCodes={showCodes} />;
  const cls = `card card-border print-break w-full overflow-hidden bg-base-100 text-left ${isNew ? "arrive" : ""}`;

  const inner = (
    <>
      {body}
      {flagged && (
        <div className="flex items-center gap-1.5 bg-warning/15 px-4 py-1.5 text-xs font-medium">
          <TriangleAlert className="size-3.5 text-warning" aria-hidden /> Some details may be misread. Open to check them.
        </div>
      )}
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} className={`${cls} cursor-pointer transition-shadow hover:shadow-md focus-visible:shadow-md`}>{inner}</button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function FlightBody({ entry, showCodes, badge }: { entry: CardEntry; showCodes: boolean; badge: boolean }) {
  const { item } = entry;
  const minutes = item.startAt && item.endAt ? Math.round((Date.parse(item.endAt) - Date.parse(item.startAt)) / 60000) : null;
  const fno = item.carrier && item.number ? `${item.carrier} ${item.number}` : null;
  const op = item.operatingCarrier && item.operatingNumber ? `${item.operatingCarrier} ${item.operatingNumber}` : null;
  return (
    <>
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 font-semibold">
            <span className="badge badge-primary badge-sm wide">{fno ?? "Flight"}</span>
            {op && <span className="font-normal text-base-content/60">operated as {op}</span>}
          </span>
          {badge && <ReliabilityBadge item={item} />}
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-3">
          <div>
            <div className="wide text-2xl font-bold leading-none sm:text-3xl">{item.origin ?? "???"}</div>
            <div className="mt-1 truncate text-sm text-base-content/60">{item.originCity ?? "\u00a0"}</div>
          </div>
          <div className="min-w-12 pb-6 text-center text-xs text-base-content/60 sm:min-w-20">
            <div className="mb-1 flex items-center gap-1" aria-hidden>
              <span className="h-px flex-1 bg-base-300" /><TypeIcon type="flight" className="size-3.5 rotate-45 text-primary" /><span className="h-px flex-1 bg-base-300" />
            </div>
            {minutes != null && minutes > 0 ? durationLabel(minutes) : ""}
          </div>
          <div className="text-right">
            <div className="wide text-2xl font-bold leading-none sm:text-3xl">{item.destination ?? "???"}</div>
            <div className="mt-1 whitespace-nowrap text-sm text-base-content/60">
              {entry.endLocal ? (
                <>
                  <span className="hidden sm:inline">lands </span>
                  <span className="font-semibold text-base-content">{entry.endLocal}</span>
                  {entry.endDayOffset > 0 && <sup className="ml-0.5 font-semibold text-accent">+{entry.endDayOffset}</sup>}
                </>
              ) : (item.destinationCity ?? "\u00a0")}
            </div>
          </div>
        </div>
      </div>
      <Details item={item} showCodes={showCodes} perforated />
    </>
  );
}

function PlainBody({ entry, showCodes }: { entry: CardEntry; showCodes: boolean }) {
  const { item } = entry;
  const where = [item.origin, item.destination && item.destination !== item.origin ? item.destination : null]
    .filter(Boolean).join(" to ");
  return (
    <>
      <div className="px-4 py-3">
        <div className="font-semibold leading-snug">{item.title}</div>
        <div className="text-sm text-base-content/60">
          {TYPE_LABEL[item.type] ?? item.type}
          {where ? `, ${where}` : ""}
          {entry.endLocal && (
            <> until {entry.endLocal}{entry.endDayOffset > 0 && <sup className="ml-0.5">+{entry.endDayOffset}</sup>}</>
          )}
          {entry.afterArrival && <span className="badge badge-ghost badge-sm ml-2 align-middle">after you land</span>}
        </div>
      </div>
      <Details item={item} showCodes={showCodes} />
    </>
  );
}

function Details({ item, showCodes, perforated }: { item: ItemDTO; showCodes: boolean; perforated?: boolean }) {
  const parts: [string, string][] = [];
  if (showCodes && item.confirmationCode) parts.push(["Booking", item.confirmationCode]);
  if (showCodes && item.seat) parts.push(["Seat", item.seat]);
  if (item.terminal) parts.push(["Terminal", item.terminal]);
  if (item.gate) parts.push(["Gate", item.gate]);
  if (!parts.length && !item.address) return null;
  return (
    <div className={`${perforated ? "perf" : "border-t border-base-300"} bg-base-100 px-4 py-2.5 text-sm`}>
      {parts.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {parts.map(([k, v]) => (
            <div key={k} className="flex min-w-0 gap-1.5">
              <dt className="text-base-content/60">{k}</dt>
              <dd className="wide truncate font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.address && <div className="mt-0.5 truncate text-base-content/60">{item.address}</div>}
    </div>
  );
}

type Badge = { onTime: number; operated: number; rating: string } | null;

/** Track-record badge from cache only, so browsing never spends flight-API calls. */
function ReliabilityBadge({ item }: { item: ItemDTO }) {
  const [badge, setBadge] = useState<Badge>(null);
  useEffect(() => {
    if (!item.carrier || !item.number || !item.origin || !item.startAt) return;
    let alive = true;
    fetch(`/api/flights/history?itemId=${item.id}&cachedOnly=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.summary?.operated) setBadge(j.summary); })
      .catch(() => {});
    return () => { alive = false; };
  }, [item.id, item.carrier, item.number, item.origin, item.startAt]);
  if (!badge) return null;
  const tone = badge.rating === "good" ? "badge-success" : badge.rating === "fair" ? "badge-warning" : "badge-error";
  return <span className={`badge badge-soft badge-sm ${tone}`}>On time {badge.onTime}/{badge.operated}</span>;
}
