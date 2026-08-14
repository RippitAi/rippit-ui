import type { Metadata } from "next";
import { Monitor } from "@/components/monitor/Monitor";

export const metadata: Metadata = {
  title: "Rippit Monitor",
};

/*
 * Feature flags from the handoff, exposed as query params while the
 * surface runs on fixture data:
 *   /monitor?incident=1          — SMS node failing, error-heavy feed
 *   /monitor?client=1            — client view (hides Config + cost)
 *   /monitor?speed=1.5           — simulation speed 0.5–2×
 */
export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const incident = params.incident === "1" || params.incident === "true";
  const clientView = params.client === "1" || params.client === "true";
  const speed = Math.min(2, Math.max(0.5, Number(params.speed) || 1));

  return <Monitor incident={incident} clientView={clientView} simSpeed={speed} />;
}
