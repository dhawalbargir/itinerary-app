import type { ItemDTO } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** RFC 5545 calendar with one event per scheduled item, in UTC (SH-2). */
export function toICS(title: string, items: ItemDTO[]) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//itinerary-app//EN", "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(title)}`];
  const now = stamp(new Date().toISOString());
  for (const i of items) {
    if (!i.startAt) continue;
    const end = i.endAt ?? new Date(Date.parse(i.startAt) + 30 * 60000).toISOString();
    const where = [i.origin, i.destination].filter(Boolean).join(" → ") || i.address || "";
    const desc = [
      i.carrier && i.number ? `Flight/Train: ${i.carrier}${i.number}` : null,
      i.confirmationCode ? `Confirmation: ${i.confirmationCode}` : null,
      i.seat ? `Seat: ${i.seat}` : null,
      i.terminal ? `Terminal: ${i.terminal}` : null,
      i.address, i.notes,
    ].filter(Boolean).join("\n");
    lines.push("BEGIN:VEVENT", `UID:${i.id}@itinerary-app`, `DTSTAMP:${now}`,
      `DTSTART:${stamp(new Date(i.startAt).toISOString())}`, `DTEND:${stamp(new Date(end).toISOString())}`,
      `SUMMARY:${esc(i.title)}`);
    if (where) lines.push(`LOCATION:${esc(where)}`);
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // Fold long lines at 75 octets.
  return lines.map((l) => (l.length <= 75 ? l : l.match(/.{1,74}/g)!.join("\r\n "))).join("\r\n") + "\r\n";
}
