"use client";

import { useEffect, useRef } from "react";
import { CYCLE, WORLD } from "./data";
import type { EdgeView } from "./Monitor";

/*
 * Live run pulses. Each edge owns a slot [t0, t1] in a 7s master cycle;
 * during its slot a comet (blurred halo + core + two trailing dots)
 * travels the edge path. Two waves run at once, offset by half a cycle.
 * Implemented as a rAF loop positioning dots via getPointAtLength()
 * (the production approach recommended by the handoff — pausable and
 * ready to be driven by real run events).
 */

interface DotSpec {
  r: number;
  op: number;
  delay: number; // seconds (real time)
  halo: boolean;
  wave: number; // 0 or 1 (half-cycle offset)
}

const DOTS: DotSpec[] = [
  { r: 8, op: 0.5, delay: 0, halo: true, wave: 0 },
  { r: 3.5, op: 1, delay: 0, halo: false, wave: 0 },
  { r: 2.2, op: 0.55, delay: 0.07, halo: false, wave: 0 },
  { r: 1.5, op: 0.3, delay: 0.14, halo: false, wave: 0 },
  { r: 8, op: 0.5, delay: 0, halo: true, wave: 1 },
  { r: 3.5, op: 1, delay: 0, halo: false, wave: 1 },
];

export function Pulses({
  edges,
  speed,
  paused,
}: {
  edges: EdgeView[];
  speed: number;
  paused: boolean;
}) {
  const paths = useRef(new Map<number, SVGPathElement>());
  const dots = useRef(new Map<string, SVGCircleElement>());
  const clock = useRef({ sim: 0, last: 0 });
  const pausedRef = useRef(paused);
  const speedRef = useRef(speed);
  const edgesRef = useRef(edges);
  useEffect(() => {
    pausedRef.current = paused;
    speedRef.current = speed;
    edgesRef.current = edges;
  }, [paused, speed, edges]);

  useEffect(() => {
    let raf = 0;
    clock.current.last = performance.now();

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - clock.current.last) / 1000);
      clock.current.last = now;
      if (!pausedRef.current) clock.current.sim += dt * speedRef.current;
      const t = clock.current.sim % CYCLE;

      for (const e of edgesRef.current) {
        const path = paths.current.get(e.id);
        if (!path) continue;
        let len = -1;
        for (let i = 0; i < DOTS.length; i++) {
          const spec = DOTS[i];
          const el = dots.current.get(`${e.id}:${i}`);
          if (!el) continue;
          const off = spec.wave * (CYCLE / 2) + spec.delay * speedRef.current;
          const tt = (t - off + CYCLE) % CYCLE;
          if (tt >= e.t0 && tt <= e.t1 && e.t1 > e.t0) {
            if (len < 0) len = path.getTotalLength();
            const frac = (tt - e.t0) / (e.t1 - e.t0);
            const p = path.getPointAtLength(frac * len);
            el.setAttribute("cx", String(p.x));
            el.setAttribute("cy", String(p.y));
            el.setAttribute("opacity", String(spec.op));
          } else {
            el.setAttribute("opacity", "0");
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg
      width={WORLD.w}
      height={WORLD.h}
      className="pointer-events-none absolute inset-0"
      style={{ overflow: "visible" }}
    >
      {edges.map((e) => (
        <g key={e.id}>
          <path
            ref={(el) => {
              if (el) paths.current.set(e.id, el);
              else paths.current.delete(e.id);
            }}
            d={e.d}
            fill="none"
            stroke="none"
          />
          {DOTS.map((spec, i) => (
            <circle
              key={i}
              ref={(el) => {
                if (el) dots.current.set(`${e.id}:${i}`, el);
                else dots.current.delete(`${e.id}:${i}`);
              }}
              r={spec.r}
              fill={spec.halo ? e.halo : e.core}
              opacity={0}
              style={spec.halo ? { filter: "blur(6px)" } : undefined}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
