"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * The browser's origin, SSR-safe.
 *
 * `useSyncExternalStore` rather than an effect: the value never changes after
 * hydration, so there is nothing to synchronise — and setting state from an
 * effect just to read a constant causes a cascading render.
 */
export function useOrigin(): string {
  return useSyncExternalStore(
    noop,
    () => window.location.origin,
    () => "" // server snapshot: no origin until hydrated
  );
}
