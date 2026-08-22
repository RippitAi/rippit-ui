"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

/*
 * Shell state shared by the icon rail, the browser column and the views:
 *  - railOpen: whether the 206px workflow browser is showing (persisted)
 *  - escape layers: the topmost registered handler wins on Esc, so a page
 *    can close its dock without fighting dialogs/palette (which register
 *    above it while open)
 */

const RAIL_KEY = "rippit.railOpen";
const listeners = new Set<() => void>();
let railCache: boolean | null = null;

function readRail(): boolean {
  if (railCache !== null) return railCache;
  try {
    railCache = localStorage.getItem(RAIL_KEY) === "1";
  } catch {
    railCache = false;
  }
  return railCache;
}
function writeRail(v: boolean) {
  railCache = v;
  try {
    localStorage.setItem(RAIL_KEY, v ? "1" : "0");
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

type EscapeHandler = () => boolean | void;

interface ShellCtx {
  railOpen: boolean;
  setRailOpen: (v: boolean) => void;
  toggleRail: () => void;
  /** Register an Esc handler; returns the unregister. Last registered wins. */
  pushEscape: (h: EscapeHandler) => () => void;
  /** Fire the topmost Esc handler; true when one consumed it. */
  fireEscape: () => boolean;
}

const Ctx = createContext<ShellCtx>({
  railOpen: false,
  setRailOpen: () => {},
  toggleRail: () => {},
  pushEscape: () => () => {},
  fireEscape: () => false,
});

export function useShell() {
  return useContext(Ctx);
}

/** Register an Esc handler for as long as `active` is true. */
export function useEscape(active: boolean, handler: EscapeHandler) {
  const { pushEscape } = useShell();
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    return pushEscape(() => ref.current());
  }, [active, pushEscape]);
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const railOpen = useSyncExternalStore(subscribe, readRail, () => false);
  const stack = useRef<EscapeHandler[]>([]);

  const setRailOpen = useCallback((v: boolean) => writeRail(v), []);
  const toggleRail = useCallback(() => writeRail(!readRail()), []);
  const pushEscape = useCallback((h: EscapeHandler) => {
    stack.current.push(h);
    return () => {
      stack.current = stack.current.filter((x) => x !== h);
    };
  }, []);
  const fireEscape = useCallback(() => {
    const top = stack.current[stack.current.length - 1];
    if (!top) return false;
    return top() !== false;
  }, []);

  const value = useMemo(
    () => ({ railOpen, setRailOpen, toggleRail, pushEscape, fireEscape }),
    [railOpen, setRailOpen, toggleRail, pushEscape, fireEscape]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** True when the event target is a text-entry element (skip shortcuts). */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/** True when a Radix dialog / menu / popover is currently open. */
export function overlayOpen(): boolean {
  return !!document.querySelector(
    '[role="dialog"][data-state="open"], [role="menu"][data-state="open"], [role="listbox"][data-state="open"], [data-radix-popper-content-wrapper]'
  );
}
