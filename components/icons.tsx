import { BedDouble, Bus, Car, MapPin, Plane, Ship, Shuffle, Ticket, TrainFront, UtensilsCrossed, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  flight: Plane, train: TrainFront, bus: Bus, ferry: Ship,
  hotel_checkin: BedDouble, hotel_checkout: BedDouble, car_pickup: Car, car_dropoff: Car,
  activity: Ticket, restaurant: UtensilsCrossed, transfer: Shuffle, other: MapPin,
};

export function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ICONS[type] ?? MapPin;
  return <Icon className={className} aria-hidden strokeWidth={1.75} />;
}
