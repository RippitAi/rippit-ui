"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

/** Count-up number for stat entrances (settles in ~700ms; reduced motion → instant). */
export function useCountUp(target: number, delayMs = 0): number {
  const reduced = usePrefersReducedMotion();
  const [anim, setAnim] = useState<{ target: number; n: number }>({ target, n: 0 });
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    let start = 0;
    const t0 = setTimeout(() => {
      const tick = (ts: number) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / 700, 1);
        setAnim({ target, n: Math.round(target * (1 - Math.pow(1 - p, 3))) });
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delayMs);
    return () => {
      clearTimeout(t0);
      cancelAnimationFrame(raf);
    };
  }, [target, delayMs, reduced]);
  if (reduced) return target;
  return anim.target === target ? anim.n : 0;
}
