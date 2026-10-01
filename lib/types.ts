/** Item as sent to the browser (dates as ISO strings). */
export type ItemDTO = {
  id: string;
  tripId: string;
  documentId: string | null;
  bookingGroup: string | null;
  type: string;
  title: string;
  startAt: string | null;
  startTz: string | null;
  endAt: string | null;
  endTz: string | null;
  origin: string | null;
  destination: string | null;
  address: string | null;
  confirmationCode: string | null;
  carrier: string | null;
  number: string | null;
  operatingCarrier: string | null;
  operatingNumber: string | null;
  seat: string | null;
  terminal: string | null;
  gate: string | null;
  travellers: string[] | null;
  notes: string | null;
  fieldConfidence: Record<string, number> | null;
  userEdited: string[];
  originCity?: string | null;      // airport city for flights, filled on the server
  destinationCity?: string | null;
};

export type DocDTO = {
  id: string;
  blobUrl: string;
  mimeType: string;
  fileName: string | null;
  status: string;
  error: string | null;
  createdAt: string;
};

export const ITEM_TYPES = [
  "flight", "train", "bus", "ferry", "hotel_checkin", "hotel_checkout",
  "car_pickup", "car_dropoff", "activity", "restaurant", "transfer", "other",
] as const;

export const TYPE_LABEL: Record<string, string> = {
  flight: "Flight", train: "Train", bus: "Bus", ferry: "Ferry",
  hotel_checkin: "Hotel check-in", hotel_checkout: "Hotel check-out",
  car_pickup: "Car pickup", car_dropoff: "Car drop-off",
  activity: "Activity", restaurant: "Restaurant", transfer: "Transfer", other: "Other",
};

export const TRANSPORT = new Set(["flight", "train", "bus", "ferry", "transfer"]);

export function toItemDTO(i: {
  [k: string]: unknown; startAt: Date | null; endAt: Date | null;
}): ItemDTO {
  return {
    ...(i as unknown as ItemDTO),
    startAt: i.startAt ? i.startAt.toISOString() : null,
    endAt: i.endAt ? i.endAt.toISOString() : null,
  };
}
