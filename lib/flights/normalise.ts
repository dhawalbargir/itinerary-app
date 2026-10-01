/** "ai", " 0131" → "AI131" */
export function normaliseFlightNo(carrier: string | null | undefined, number: string | null | undefined) {
  if (!carrier || !number) return null;
  const c = carrier.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const n = number.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/^0+(?=\d)/, "");
  if (!/^[A-Z0-9]{2,3}$/.test(c) || !/^\d{1,4}[A-Z]?$/.test(n)) return null;
  return `${c}${n}`;
}

/** "AI 0131" → "AI131" */
export function parseFlightNo(s: string) {
  const m = s.toUpperCase().replace(/\s+/g, "").match(/^([A-Z0-9]{2}[A-Z]?)(\d{1,4}[A-Z]?)$/);
  if (!m) return null;
  return normaliseFlightNo(m[1], m[2]);
}
