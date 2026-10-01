"use client";

import type { Timeline as T } from "@/lib/timeline";
import { Timeline } from "./Timeline";

export function SharedTimeline({ timeline, showCodes }: { timeline: T; showCodes: boolean }) {
  return <Timeline timeline={timeline} readOnly showCodes={showCodes} />;
}
