import { makeConnector } from "./make";
import { ghlConnector } from "./ghl";
import type { ConnectorDescriptor, ProviderId } from "./types";

export * from "./types";

/** Registered connectors, in display order. Adding a platform = one entry. */
export const CONNECTORS: Record<ProviderId, ConnectorDescriptor> = {
  make: makeConnector,
  ghl: ghlConnector,
};

export function allConnectors(): ConnectorDescriptor[] {
  return Object.values(CONNECTORS);
}

export function getConnector(id: ProviderId): ConnectorDescriptor {
  return CONNECTORS[id];
}

export function isProviderId(s: string): s is ProviderId {
  return s in CONNECTORS;
}

export function providerColor(id: ProviderId): string {
  return CONNECTORS[id].brandColor;
}

export function providerLabel(id: ProviderId): string {
  return CONNECTORS[id].label;
}

/**
 * Tooltip copy for canvas node badges. Badges reference the platform a node
 * talks to, so the copy is resolved centrally rather than per-descriptor.
 * Supports the generic "talksTo:<provider>" form alongside legacy names.
 */
export function badgeTooltip(badge: string): string | null {
  if (badge === "deadLink") return "Link target is missing or disabled";
  if (badge === "unmatchedLink")
    return `Webhook target not found in ${CONNECTORS.make.label}`;
  if (badge === "talksToGhl") return `Calls ${CONNECTORS.ghl.shortLabel}`;
  if (badge.startsWith("talksTo:")) {
    const id = badge.slice("talksTo:".length);
    return isProviderId(id) ? `Calls ${CONNECTORS[id].shortLabel}` : null;
  }
  return null;
}
