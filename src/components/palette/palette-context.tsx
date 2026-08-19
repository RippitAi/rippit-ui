"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { NodeId } from "@/app/lib/api";

/*
 * Command-palette state + the "canvas scope" registration: a workflow page
 * can register its visible nodes so the palette offers "Focus: <step>"
 * entries while that page is open.
 */

export interface PaletteScope {
  label: string;
  nodes: { id: NodeId; label: string }[];
  onSelect: (id: NodeId) => void;
}

interface PaletteCtx {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (open: boolean) => void;
  scope: PaletteScope | null;
  registerScope: (scope: PaletteScope | null) => void;
}

const Ctx = createContext<PaletteCtx>({
  isOpen: false,
  open: () => {},
  close: () => {},
  setOpen: () => {},
  scope: null,
  registerScope: () => {},
});

export function usePalette() {
  return useContext(Ctx);
}

/** Register the current page's canvas nodes with the palette. */
export function usePaletteScope(scope: PaletteScope | null) {
  const { registerScope } = usePalette();
  useEffect(() => {
    registerScope(scope);
    return () => registerScope(null);
  }, [scope, registerScope]);
}

export function PaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<PaletteScope | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const registerScope = useCallback(
    (s: PaletteScope | null) => setScope(s),
    []
  );

  const value = useMemo(
    () => ({ isOpen, open, close, setOpen: setIsOpen, scope, registerScope }),
    [isOpen, open, close, scope, registerScope]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
