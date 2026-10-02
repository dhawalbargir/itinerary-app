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

const low = (i: ItemDTO) =>
  Object.entries(i.fieldConfidence ?? {}).some(([k, v]) => v < 0.7 && !i.userEdited.includes(confToField(k)));

export function confToField(k: string) {
  const map: Record<string, string> = {
    start_local: "startAt", end_local: "endAt", start_place: "origin", end_place: "destination",
    confirmation_code: "confirmationCode", operating_carrier: "operatingCarrier", operating_number: "operatingNumber",
  };
  return map[k] ?? k;
}

export function ItemCard({
  entry, onOpen, readOnly, showCodes = true, isNew,
}: { entry: CardEntry; onOpen?: () => void; readOnly?: boolean; showCodes?: boolean; isNew?: boolean }) {
  const { item } = entry;
  const flagged = !readOnly && low(item);
  const Wrapper = onOpen ? "button" : "div";

  return (
    <Wrapper
      type={onOpen ? "button" : undefined}
      onClick={onOpen}
      className={`print-break block w-full text-left rounded-xl bg-surface border border-line overflow-hidden ${onOpen ? "hover:border-muted cursor-pointer" : ""} ${isNew ? "arrive" : ""}`}
    >
      {item.type === "flight" ? (
        <FlightBody entry={entry} showCodes={showCodes} badge={!readOnly} />
      ) : (
        <PlainBody entry={entry} showCodes={showCodes} />
      )}
      {flagged && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-warn bg-warn-bg">
          <TriangleAlert className="size-3.5" aria-hidden /> Some details may be misread. Check them.
        </div>
      )}
    </Wrapper>
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
            <TypeIcon type="flight" className="size-4" />
            {fno ?? "Flight"}
            {op && <span className="font-normal text-muted">operated as {op}</span>}
          </span>
          {badge && <ReliabilityBadge item={item} />}
        </div>
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 sm:gap-3">
          <div>
            <div className="wide text-2xl sm:text-3xl font-bold leading-none">{item.origin ?? "???"}</div>
            <div className="mt-1 text-sm text-muted truncate">{item.originCity ?? "\u00a0"}</div>
          </div>
          <div className="pb-6 text-center text-xs text-muted min-w-12 sm:min-w-16">
            <div className="h-px bg-line mb-1" />
            {minutes != null && minutes > 0 ? durationLabel(minutes) : ""}
          </div>
          <div className="text-right">
            <div className="wide text-2xl sm:text-3xl font-bold leading-none">{item.destination ?? "???"}</div>
            <div className="mt-1 text-sm text-muted whitespace-nowrap">
              {entry.endLocal ? (
                <>
                  <span className="hidden sm:inline">arrives </span><span className="font-semibold text-ink">{entry.endLocal}</span>
                  {entry.endDayOffset > 0 && <sup className="ml-0.5 font-semibold text-ink">+{entry.endDayOffset}</sup>}
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
  const hasDetails = (showCodes && item.confirmationCode) || item.address || (showCodes && item.seat);
  return (
    <>
      <div className="flex gap-3 px-4 py-3">
        <TypeIcon type={item.type} className="mt-0.5 size-5 shrink-0 text-muted" />
        <div className="min-w-0">
          <div className="font-semibold leading-snug">{item.title}</div>
          <div className="text-sm text-muted">
            {TYPE_LABEL[item.type] ?? item.type}
            {where ? `, ${where}` : ""}
            {entry.afterArrival ? ", after you land" : ""}
            {entry.endLocal && (
              <>
                {" "}until {entry.endLocal}
                {entry.endDayOffset > 0 && <sup className="ml-0.5">+{entry.endDayOffset}</sup>}
              </>
            )}
          </div>
        </div>
      </div>
      {hasDetails && <Details item={item} showCodes={showCodes} />}
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
    <div className={`${perforated ? "perf" : "border-t border-line"} px-4 py-2.5 text-sm`}>
      {parts.length > 0 && (
        <dl className="flex flex-wrap gap-x-5 gap-y-1">
          {parts.map(([k, v]) => (
            <div key={k} className="flex gap-1.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold wide">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.address && <div className="text-muted mt-0.5 truncate">{item.address}</div>}
    </div>
  );
}

type Badge = { onTime: number; operated: number; rating: string } | null;

/** Shows the track record only from cache, so loading a page never spends flight-API calls. */
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
  const tone = badge.rating === "good" ? "bg-good-bg text-good" : badge.rating === "fair" ? "bg-warn-bg text-warn" : "bg-bad-bg text-bad";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      On time {badge.onTime}/{badge.operated}
    </span>
  );
}
