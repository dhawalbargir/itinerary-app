import { z } from "zod";

export const EXTRACTED_TYPES = [
  "flight", "train", "bus", "ferry", "hotel", "car_rental",
  "activity", "restaurant", "transfer", "other",
] as const;

const str = z.string().nullable().optional();

export const ExtractedItem = z.object({
  type: z.enum(EXTRACTED_TYPES),
  title: z.string().min(1),
  start_local: str.describe(
    "Start as printed, local wall-clock time: 'YYYY-MM-DDTHH:mm', or 'YYYY-MM-DD' if no time. If the year is not printed use '--MM-DDTHH:mm'.",
  ),
  start_place: str.describe("Flights: 3-letter IATA departure airport. Others: city of the start (or of the venue/hotel)."),
  start_tz: str.describe("IANA time zone of start_place if you are confident, e.g. 'Europe/Paris'."),
  end_local: str.describe("End / arrival / check-out, same format as start_local."),
  end_place: str.describe("Flights: 3-letter IATA arrival airport. Others: city of the end."),
  end_tz: str,
  address: str,
  carrier: str.describe("Marketing airline / rail operator code as printed, e.g. 'AI', '6E', 'BA'."),
  number: str.describe("Flight or train number without the carrier code, e.g. '131'."),
  operating_carrier: str.describe("Only if the document says 'operated by' a different airline."),
  operating_number: str,
  confirmation_code: str.describe("Booking reference / PNR / confirmation number."),
  travellers: z.array(z.string()).nullable().optional(),
  seat: str,
  terminal: str,
  gate: str,
  notes: str.describe("Short useful extras: baggage, room type, meal, pickup point. Max 200 chars."),
  confidence: z
    .record(z.string(), z.number().min(0).max(1))
    .nullable()
    .optional()
    .describe("Confidence 0-1 for each field you filled, keyed by field name."),
});

export const Extraction = z.object({
  items: z.array(ExtractedItem),
  document_kind: str.describe("e.g. 'e-ticket', 'boarding pass', 'hotel confirmation'"),
});

export type ExtractedItemT = z.infer<typeof ExtractedItem>;
export type ExtractionT = z.infer<typeof Extraction>;

/** JSON schema for the Anthropic tool definition. */
export function extractionJsonSchema() {
  const schema = z.toJSONSchema(Extraction) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}
