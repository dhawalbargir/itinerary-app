"use client";

import { Fragment, useState } from "react";
import { BedDouble, CalendarX2, ChevronRight, GripVertical, TriangleAlert } from "lucide-react";
import type { Timeline as TimelineT, Entry } from "@/lib/timeline";
import type { ItemDTO } from "@/lib/types";
import { TRANSPORT } from "@/lib/types";
import { dayHeading, durationLabel, zoneAbbr } from "@/lib/format";
import { ItemCard } from "./ItemCard";
import { TypeIcon } from "./icons";

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
    <div className="space-y-8">
      {!readOnly && timeline.unscheduled.length > 0 && (
        <section aria-labelledby="unscheduled" className="no-print rounded-box border border-warning/40 bg-warning/10 p-4">
          <h2 id="unscheduled" className="flex items-center gap-2 font-semibold">
            <CalendarX2 className="size-5 text-warning" aria-hidden />
            {timeline.unscheduled.length === 1 ? "1 item has no date" : `${timeline.unscheduled.length} items have no date`}
          </h2>
          <p className="mt-0.5 text-sm text-base-content/70">Open one to set its date, or drag it onto a day below.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {timeline.unscheduled.map((item) => (
              <li key={item.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/item-id", item.id)} className="flex items-stretch gap-1">
                <span className="hidden cursor-grab items-center text-base-content/40 sm:flex" aria-hidden><GripVertical className="size-4" /></span>
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
              className={`sticky top-16 z-10 -mx-2 mb-3 rounded-box border px-3 py-2 backdrop-blur transition-colors sm:-mx-3 ${dragOver === day.date ? "border-secondary bg-secondary/20" : "border-transparent bg-base-200/90"}`}
              onDragOver={readOnly ? undefined : (e) => { e.preventDefault(); setDragOver(day.date); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={readOnly ? undefined : (e) => {
                e.preventDefault(); setDragOver(null);
                const id = e.dataTransfer.getData("text/item-id");
                if (id) onDropOnDay?.(id, day.date);
              }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="wide text-2xl font-extrabold">{h.day}</h2>
                <span className="text-base-content/60">{h.weekday}</span>
                {isToday && <span className="badge badge-secondary badge-sm">Today</span>}
                {day.cities.length > 0 && (
                  <span className="ml-auto flex flex-wrap items-center gap-1 text-sm font-medium">
                    {day.cities.map((c, i) => (
                      <Fragment key={i}>
                        {i > 0 && <ChevronRight className="size-3.5 text-base-content/40" aria-label="to" />}
                        <span>{c}</span>
                      </Fragment>
                    ))}
                  </span>
                )}
              </div>
              {day.staying.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {day.staying.map((s) => (
                    <span key={s} className="badge badge-ghost badge-sm gap-1"><BedDouble className="size-3.5" aria-hidden /> {s}</span>
                  ))}
                </div>
              )}
            </header>

            <ul className="timeline timeline-vertical trip-timeline">
              {day.entries.map((e, idx) => {
                const prev = idx > 0 ? day.entries[idx - 1].item : null;
                const first = idx === 0;
                const last = idx === day.entries.length - 1;
                return (
                  <Fragment key={e.item.id}>
                    {e.gapBefore && <GapRow e={e} prev={prev} />}
                    <li>
                      {!first || e.gapBefore ? <hr /> : null}
                      <div className="timeline-start">
                        {e.item.type === "hotel_checkin" && <div className="mb-0.5 text-[0.7rem] leading-none text-base-content/60">from</div>}
                        <div className="wide text-base font-bold leading-none sm:text-lg">{e.startLocal}</div>
                        <div className="mt-1 text-[0.7rem] text-base-content/60">{zoneAbbr(e.item.startAt!, e.item.startTz)}</div>
                      </div>
                      <div className="timeline-middle">
                        <span className={`grid size-8 place-items-center rounded-full ${TRANSPORT.has(e.item.type) ? "bg-primary text-primary-content" : "border border-base-300 bg-base-100 text-base-content/70"}`}>
                          <TypeIcon type={e.item.type} className="size-4" />
                        </span>
                      </div>
                      <div className="timeline-end">
                        {e.warning && (
                          <div role="alert" className="alert alert-error alert-soft mb-2 px-3 py-1.5 text-xs font-semibold">
                            <TriangleAlert className="size-4" aria-hidden /> {e.warning}
                          </div>
                        )}
                        <ItemCard
                          entry={e}
                          readOnly={readOnly}
                          showCodes={showCodes}
                          isNew={newIds?.has(e.item.id)}
                          onOpen={onOpen ? () => onOpen(e.item) : undefined}
                        />
                      </div>
                      {!last ? <hr /> : null}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function GapRow({ e, prev }: { e: Entry; prev: ItemDTO | null }) {
  const g = e.gapBefore!;
  const where = g.kind === "layover" ? prev?.destinationCity ?? prev?.destination : null;
  return (
    <li className={g.kind === "layover" ? "leg" : ""}>
      <hr />
      <div className="timeline-middle"><span className="block size-2.5 rounded-full border-2 border-primary/60 bg-base-200" aria-hidden /></div>
      <div className="timeline-end !mb-3 text-xs text-base-content/60">
        {g.kind === "layover" ? "Layover" : "Free time"} {durationLabel(g.minutes)}{where ? ` in ${where}` : ""}
      </div>
      <hr />
    </li>
  );
}
