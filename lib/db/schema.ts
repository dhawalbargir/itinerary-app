import {
  pgTable, uuid, text, timestamp, date, integer, jsonb, doublePrecision,
  primaryKey, index, unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  datesInferred: text("dates_inferred").notNull().default("yes"), // "yes" = recompute from items
  shareToken: text("share_token").unique(),
  shareShowCodes: text("share_show_codes").notNull().default("no"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    blobPath: text("blob_path"),
    mimeType: text("mime_type").notNull(),
    fileName: text("file_name"),
    sha256: text("sha256").notNull(),
    status: text("status").notNull().default("uploaded"), // uploaded | processing | done | failed | manual
    rawExtraction: jsonb("raw_extraction"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("documents_trip_sha").on(t.tripId, t.sha256)],
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    documentId: uuid("document_id").references(() => documents.id, { onDelete: "set null" }),
    bookingGroup: uuid("booking_group"),
    type: text("type").notNull(),
    title: text("title").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }),
    startTz: text("start_tz"),
    endAt: timestamp("end_at", { withTimezone: true }),
    endTz: text("end_tz"),
    origin: text("origin"),
    destination: text("destination"),
    address: text("address"),
    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    confirmationCode: text("confirmation_code"),
    carrier: text("carrier"),
    number: text("number"),
    operatingCarrier: text("operating_carrier"),
    operatingNumber: text("operating_number"),
    seat: text("seat"),
    terminal: text("terminal"),
    gate: text("gate"),
    travellers: text("travellers").array(),
    notes: text("notes"),
    fieldConfidence: jsonb("field_confidence").$type<Record<string, number>>(),
    userEdited: text("user_edited").array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("items_trip_start").on(t.tripId, t.startAt)],
);

export const flightHistory = pgTable(
  "flight_history",
  {
    flightNo: text("flight_no").notNull(),
    depIata: text("dep_iata").notNull(),
    flightDate: date("flight_date").notNull(),
    schedDep: timestamp("sched_dep", { withTimezone: true }),
    actualDep: timestamp("actual_dep", { withTimezone: true }),
    schedArr: timestamp("sched_arr", { withTimezone: true }),
    actualArr: timestamp("actual_arr", { withTimezone: true }),
    depTz: text("dep_tz"),
    arrTz: text("arr_tz"),
    arrDelayMin: integer("arr_delay_min"),
    status: text("status").notNull(), // on_time | delayed | cancelled | diverted | not_scheduled | scheduled | unknown
    aircraft: text("aircraft"),
    provider: text("provider").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.flightNo, t.depIata, t.flightDate] })],
);

export const apiUsage = pgTable(
  "api_usage",
  {
    day: date("day").notNull(),
    provider: text("provider").notNull(),
    calls: integer("calls").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.provider] })],
);

export type Trip = typeof trips.$inferSelect;
export type Doc = typeof documents.$inferSelect;
export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;
export type FlightHistoryRow = typeof flightHistory.$inferSelect;
