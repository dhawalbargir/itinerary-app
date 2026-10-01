"use client";

import { useState } from "react";
import { BedDouble, CircleAlert, GripVertical, TriangleAlert } from "lucide-react";
import type { Timeline as TimelineT } from "@/lib/timeline";
import type { ItemDTO } from "@/lib/types";
import { dayHeading, durationLabel, zoneAbbr } from "@/lib/format";
import { ItemCard } from "./ItemCard";

type Props = {
  timeline: TimelineT;
  readOnly?: boolean;
  showCodes?: boolean;
  newIds?: Set<string>;
  onOpen?: (item: ItemDTO) => void;
  onDropOnDay?: (itemId: string, date: string) => void;
};

export function Timeline({ timeline, readOnly, showCodes = true, newIds, onOpen, onDropOnDay }: Props) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-10">
      {!readOnly && timeline.unscheduled.length > 0 && (
        <section aria-labelledby="unscheduled" className="no-print rounded-2xl border-2 border-dashed border-warn/60 bg-warn-bg/60 p-4">
          <h2 id="unscheduled" className="flex items-center gap-2 font-semibold text-warn">
            <CircleAlert className="size-4" aria-hidden />
            {timeline.unscheduled.length === 1 ? "1 item has no date" : `${timeline.unscheduled.length} items have no date`}
          </h2>
          <p className="mt-0.5 text-sm text-muted">Open one to set its date, or drag it onto a day.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {timeline.unscheduled.map((item) => (
              <li
                key={item.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)}
                className="flex items-stretch gap-1"
              >
                <span className="hidden sm:flex items-center text-muted cursor-grab" aria-hidden><GripVertical className="size-4" /></span>
                <div className="flex-1">
                  <ItemCard entry={{ item, startLocal: "", endLocal: null, endDayOffset: 0 }} onOpen={() => onOpen?.(item)} isNew={newIds?.has(item.id)} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {timeline.days.map((day) => {
        const h = dayHeading(day.date);
        const isToday = day.date === today;
        return (
          <section key={day.date} aria-label={`${h.weekday} ${h.day}`}>
            <header
              className={`sticky top-0 z-10 -mx-4 px-4 py-2 bg-ground/95 backdrop-blur border-b ${dragOver === day.date ? "border-sign bg-sign/20" : "border-line"}`}
              onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setDragOver(day.date); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={readOnly ? undefined : (e) => {
                e.preventDefault(); setDragOver(null);
                const id = e.dataTransfer.getData("text/item-id");
                if (id) onDropOnDay?.(id, day.date);
              }}
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <h2 className="wide text-2xl font-bold">{h.day}</h2>
                <span className="text-muted">{h.weekday}</span>
                {isToday && <span className="rounded bg-sign px-1.5 text-xs font-bold text-sign-ink">Today</span>}
                {day.cities.length > 0 && (
                  <span className="ml-auto text-sm font-medium truncate max-w-[60%]">{day.cities.join(" → ")}</span>
                )}
              </div>
              {day.staying.length > 0 && (
                <div className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <BedDouble className="size-4" aria-hidden /> Staying at {day.staying.join(", ")}
                </div>
              )}
            </header>

            <ol className="mt-4 space-y-3">
              {day.entries.map((e) => (
                <li key={e.item.id}>
                  {e.gapBefore && (
                    <div className="ml-[4.25rem] sm:ml-[5.25rem] mb-3 text-xs text-muted">
                      {e.gapBefore.kind === "layover" ? "Layover" : "Free time"} {durationLabel(e.gapBefore.minutes)}
                    </div>
                  )}
                  {e.warning && (
                    <div className="ml-[4.25rem] sm:ml-[5.25rem] mb-2 flex items-center gap-1.5 rounded-md bg-bad-bg px-2 py-1 text-xs font-semibold text-bad">
                      <TriangleAlert className="size-3.5" aria-hidden /> {e.warning}
                    </div>
                  )}
                  <div className="grid grid-cols-[3.75rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)] gap-2 sm:gap-3">
                    <div className="pt-3 text-right">
                      <div className="wide text-lg font-bold leading-none">{e.startLocal}</div>
                      <div className="mt-1 text-[0.7rem] text-muted">{zoneAbbr(e.item.startAt!, e.item.startTz)}</div>
                    </div>
                    <ItemCard
                      entry={e}
                      readOnly={readOnly}
                      showCodes={showCodes}
                      isNew={newIds?.has(e.item.id)}
                      onOpen={onOpen ? () => onOpen(e.item) : undefined}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
