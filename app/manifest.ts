import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Itinerary",
    short_name: "Itinerary",
    description: "Turn tickets and confirmations into one day-by-day trip plan.",
    start_url: "/",
    display: "standalone",
    background_color: "#e8edf0",
    theme_color: "#e8edf0",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
