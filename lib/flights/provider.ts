import type { HistoryDay } from "./summary";

export type ProviderDay = Omit<HistoryDay, "date"> & { depIata: string | null };

export interface FlightDataProvider {
  name: string;
  configured(): boolean;
  /** All legs operating under this flight number departing on `dateLocal` (YYYY-MM-DD, departure local date). */
  fetchDay(flightNo: string, dateLocal: string): Promise<ProviderDay[] | "not_operating">;
}
