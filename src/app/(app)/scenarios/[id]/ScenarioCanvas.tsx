"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import { Maximize2, Minus, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { appColor, appGlyph, appName } from "@/lib/apps";
import type { ModuleInfo, Connection } from "@/app/lib/api";

const POP_EASE = [0.34, 1.56, 0.64, 1] as const;
const NODE_HALF = 70; // wrapper is 140 wide, puck centered
const COL_W = 300;
const ROW_H = 180;
const COMP_GAP = 140;
const MARGIN_X = 160;
const MARGIN_Y = 90;
const SQRT2 = 1.4142;
const COS_TILT = 0.5736; // cos 55°
/* Usable screen box when a node is centered (right inset clears the
   inspector panel that opens on selection). */
const CENTER_INSETS = { left: 20, right: 392, top: 70, bottom: 20 };

interface CanvasNode {
  id: number;
  cx: number;
  cy: number;
  col: number;
  label: string;
  app: string;
  color: string;
  glyph: string;
  hasFilter: boolean;
  filterName: string | null;
  hasErrorHandler: boolean;
}

/*
 * Layered left-to-right layout computed from the connection graph.
 * Make.com designer coordinates are ignored on purpose — real blueprints
 * scatter modules across thousands of pixels, which forces the fit zoom
 * so far out that pucks and edges become unreadable.
 */
function computeLayout(modules: ModuleInfo[], connections: Connection[]) {
  const ids = modules.map((m) => m.id);
  const idSet = new Set(ids);
  const conns = connections.filter(
    (c) => idSet.has(c.from) && idSet.has(c.to) && c.from !== c.to
  );

  const out = new Map<number, number[]>();
  const parents = new Map<number, number[]>();
  const indeg = new Map<number, number>();
  for (const id of ids) {
    out.set(id, []);
    parents.set(id, []);
    indeg.set(id, 0);
  }
  for (const c of conns) {
    out.get(c.from)!.push(c.to);
    parents.get(c.to)!.push(c.from);
    indeg.set(c.to, (indeg.get(c.to) || 0) + 1);
  }

  /* Column = longest path from a root (Kahn's algorithm; cycle leftovers
     land in column 0). */
  const col = new Map<number, number>();
  const deg = new Map(indeg);
  const queue = ids.filter((id) => deg.get(id) === 0);
  for (const id of queue) col.set(id, 0);
  while (queue.length) {
    const id = queue.shift()!;
    for (const next of out.get(id)!) {
      col.set(next, Math.max(col.get(next) ?? 0, (col.get(id) ?? 0) + 1));
      deg.set(next, deg.get(next)! - 1);
      if (deg.get(next) === 0) queue.push(next);
    }
  }
  for (const id of ids) if (!col.has(id)) col.set(id, 0);

  /* Weakly-connected components, stacked vertically. */
  const comp = new Map<number, number>();
  let compCount = 0;
  for (const id of ids) {
    if (comp.has(id)) continue;
    const stack = [id];
    comp.set(id, compCount);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const nb of [...out.get(cur)!, ...parents.get(cur)!]) {
        if (!comp.has(nb)) {
          comp.set(nb, compCount);
          stack.push(nb);
        }
      }
    }
    compCount++;
  }

  const posOf = new Map<number, { cx: number; cy: number; col: number }>();
  const row = new Map<number, number>();
  let yOffset = 0;

  for (let ci = 0; ci < compCount; ci++) {
    const members = ids.filter((id) => comp.get(id) === ci);
    const byCol = new Map<number, number[]>();
    for (const id of members) {
      const c = col.get(id)!;
      if (!byCol.has(c)) byCol.set(c, []);
      byCol.get(c)!.push(id);
    }
    const colKeys = [...byCol.keys()].sort((a, b) => a - b);

    /* Order each column by the average row of its parents (barycenter)
       to keep edges short and mostly horizontal. */
    for (const c of colKeys) {
      const group = byCol.get(c)!;
      const keyed = group.map((id, i) => {
        const ps = parents.get(id)!.filter((p) => row.has(p));
        const bary = ps.length
          ? ps.reduce((s, p) => s + row.get(p)!, 0) / ps.length
          : i;
        return { id, bary, i };
      });
      keyed.sort((a, b) => a.bary - b.bary || a.i - b.i);
      keyed.forEach((k, r) => row.set(k.id, r));
      byCol.set(
        c,
        keyed.map((k) => k.id)
      );
    }

    const compHeight =
      Math.max(...colKeys.map((c) => byCol.get(c)!.length), 1) * ROW_H;

    for (const c of colKeys) {
      const group = byCol.get(c)!;
      const colHeight = group.length * ROW_H;
      group.forEach((id, r) => {
        posOf.set(id, {
          cx: MARGIN_X + c * COL_W,
          cy:
            MARGIN_Y +
            yOffset +
            (compHeight - colHeight) / 2 +
            r * ROW_H +
            ROW_H / 2,
          col: c,
        });
      });
    }
    yOffset += compHeight + COMP_GAP;
  }

  const maxCol = Math.max(0, ...[...col.values()]);
  return {
    posOf,
    maxCol,
    w: MARGIN_X * 2 + maxCol * COL_W,
    h: MARGIN_Y * 2 + Math.max(ROW_H, yOffset - COMP_GAP),
  };
}

interface EdgeView {
  key: number;
  d: string;
  label?: string;
  mx: number;
  my: number;
  t0: number;
  t1: number;
}

/*
 * Live pulses — the monitor's comet effect running along the real edges.
 * Each edge owns a slot in a master cycle keyed off its source column, so
 * a run visually flows left→right through the actual graph. rAF +
 * getPointAtLength, per the handoff's production recommendation.
 */
const DOTS = [
  { r: 8, op: 0.5, delay: 0, halo: true, wave: 0 },
  { r: 3.5, op: 1, delay: 0, halo: false, wave: 0 },
  { r: 2.2, op: 0.55, delay: 0.07, halo: false, wave: 0 },
  { r: 1.5, op: 0.3, delay: 0.14, halo: false, wave: 0 },
  { r: 8, op: 0.5, delay: 0, halo: true, wave: 1 },
  { r: 3.5, op: 1, delay: 0, halo: false, wave: 1 },
];

function PulseLayer({ edges, cycle }: { edges: EdgeView[]; cycle: number }) {
  const paths = useRef(new Map<number, SVGPathElement>());
  const dots = useRef(new Map<string, SVGCircleElement>());
  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    let raf = 0;
    let sim = 0;
    let last = performance.now();
    const frame = (now: number) => {
      sim += Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = sim % cycle;
      for (const e of edgesRef.current) {
        const path = paths.current.get(e.key);
        if (!path) continue;
        let len = -1;
        for (let i = 0; i < DOTS.length; i++) {
          const spec = DOTS[i];
          const el = dots.current.get(`${e.key}:${i}`);
          if (!el) continue;
          const off = spec.wave * (cycle / 2) + spec.delay;
          const tt = (t - off + cycle) % cycle;
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
  }, [cycle]);

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ overflow: "visible" }}
      width={1}
      height={1}
    >
      {edges.map((e) => (
        <g key={e.key}>
          <path
            ref={(el) => {
              if (el) paths.current.set(e.key, el);
              else paths.current.delete(e.key);
            }}
            d={e.d}
            fill="none"
            stroke="none"
          />
          {DOTS.map((spec, i) => (
            <circle
              key={i}
              ref={(el) => {
                if (el) dots.current.set(`${e.key}:${i}`, el);
                else dots.current.delete(`${e.key}:${i}`);
              }}
              r={spec.r}
              fill="var(--text)"
              opacity={0}
              style={spec.halo ? { filter: "blur(6px)" } : undefined}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}

function ClusterButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className="flex size-8 cursor-pointer items-center justify-center rounded-control border backdrop-blur-[8px] transition-colors hover:border-t1"
          style={{
            background: active ? "var(--text)" : "var(--glass)",
            borderColor: active ? "var(--text)" : "var(--line)",
            color: active ? "var(--bg)" : "var(--t2)",
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-[11px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default function ScenarioCanvas({
  modules,
  connections,
  selectedId,
  onNodeClick,
}: {
  modules: ModuleInfo[];
  connections: Connection[];
  selectedId?: number | null;
  onNodeClick?: (moduleId: number) => void;
}) {
  const [cam, setCam] = useState({ zoom: 0.5, panX: 0, panY: 0 });
  const [drag, setDrag] = useState(false);
  const [glide, setGlide] = useState(false);
  const [tilt, setTilt] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const [pos, setPos] = useState<Record<number, { cx: number; cy: number }>>({});

  const vp = useRef<HTMLDivElement | null>(null);
  const panData = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const vel = useRef({ x: 0, y: 0 });
  const last = useRef({ x: 0, y: 0, t: 0 });
  const raf = useRef(0);
  const nd = useRef<{
    id: number;
    sx: number;
    sy: number;
    cx: number;
    cy: number;
    moved: boolean;
  } | null>(null);
  const tiltRef = useRef(tilt);
  useEffect(() => {
    tiltRef.current = tilt;
  }, [tilt]);

  const layout = useMemo(
    () => computeLayout(modules, connections),
    [modules, connections]
  );
  const ox = layout.w / 2;
  const oy = layout.h / 2;

  const nodes: CanvasNode[] = useMemo(
    () =>
      modules.map((m, i) => {
        const base = layout.posOf.get(m.id) ?? {
          cx: MARGIN_X + (i % 4) * COL_W,
          cy: MARGIN_Y + Math.floor(i / 4) * ROW_H,
          col: 0,
        };
        const o = pos[m.id];
        return {
          id: m.id,
          cx: o ? o.cx : base.cx,
          cy: o ? o.cy : base.cy,
          col: base.col,
          label: m.label || m.module,
          app: m.app || m.module,
          color: appColor(m.app || m.module),
          glyph: appGlyph(m.app || m.module),
          hasFilter: m.hasFilter,
          filterName: m.filterName,
          hasErrorHandler: m.hasErrorHandler,
        };
      }),
    [modules, layout, pos]
  );

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const cycle = layout.maxCol * 0.65 + 2.2;

  const edges: EdgeView[] = useMemo(
    () =>
      connections
        .filter((c) => byId.has(c.from) && byId.has(c.to))
        .map((c, i) => {
          const a = byId.get(c.from)!;
          const b = byId.get(c.to)!;
          const flip = b.cx < a.cx ? -1 : 1;
          const sx = a.cx + 38 * flip;
          const sy = a.cy;
          const tx = b.cx - 38 * flip;
          const ty = b.cy;
          const dx = Math.max(48, Math.min(130, Math.abs(tx - sx) / 2)) * flip;
          // midpoint of the cubic at t = .5 for the label pill
          const mx = (sx + 3 * (sx + dx) + 3 * (tx - dx) + tx) / 8;
          const my = (sy + 3 * sy + 3 * ty + ty) / 8;
          const t0 = a.col * 0.65;
          return {
            key: i,
            d: `M${sx} ${sy} C${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`,
            label: c.label,
            mx,
            my,
            t0,
            t1: t0 + 0.75,
          };
        }),
    [connections, byId]
  );

  /* ---------- camera ---------- */

  const fit = useCallback(() => {
    const el = vp.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const isTilt = tiltRef.current;
    /* Projected size of the w×h content box under rotateZ45+rotateX55 */
    const pw = isTilt ? (layout.w + layout.h) / SQRT2 + 100 : layout.w;
    const ph = isTilt ? ((layout.w + layout.h) / SQRT2) * COS_TILT + 180 : layout.h;
    const pad = 70;
    /* Never fit below 0.4 zoom — a huge graph should stay readable and be
       panned, not shrink into confetti. */
    const z = Math.max(
      0.4,
      Math.min((r.width - pad * 2) / pw, (r.height - pad * 2) / ph, 1.1)
    );
    /* Topmost projected point of the content box (keeps tall graphs from
       centering their top edge off screen). */
    const topY = isTilt
      ? oy - ((layout.w + layout.h) / (2 * SQRT2)) * COS_TILT
      : 0;
    setGlide(false);
    setCam({
      zoom: z,
      panX: r.width / 2 - ox * z,
      panY: Math.max(
        r.height / 2 - oy * z - (isTilt ? 30 * z : 0),
        66 - topY * z
      ),
    });
  }, [layout, ox, oy]);

  const fitRef = useRef(fit);
  useEffect(() => {
    fitRef.current = fit;
  }, [fit]);

  const centerOn = useCallback(
    (id: number) => {
      const el = vp.current;
      if (!el) return;
      const n = byId.get(id);
      if (!n) return;
      const r = el.getBoundingClientRect();
      const P = CENTER_INSETS;
      const z = cam.zoom;
      const dx = n.cx - ox;
      const dy = n.cy - oy;
      let wx: number, wy: number;
      if (tiltRef.current) {
        wx = ox + (dx - dy) / SQRT2;
        wy = oy + ((dx + dy) / SQRT2) * COS_TILT;
      } else {
        wx = n.cx;
        wy = n.cy;
      }
      const cx = P.left + (r.width - P.left - P.right) / 2;
      const cy = P.top + (r.height - P.top - P.bottom) / 2;
      setGlide(false);
      setCam((c) => ({ ...c, panX: cx - z * wx, panY: cy - z * wy }));
    },
    [byId, cam.zoom, ox, oy]
  );

  const zoomBy = useCallback((f: number, ax?: number, ay?: number) => {
    setCam((c) => {
      const z = Math.min(1.8, Math.max(0.15, c.zoom * f));
      const el = vp.current;
      if (!el) return { ...c, zoom: z };
      const r = el.getBoundingClientRect();
      const cx = ax ?? r.width / 2;
      const cy = ay ?? r.height / 2;
      return {
        zoom: z,
        panX: cx - ((cx - c.panX) * z) / c.zoom,
        panY: cy - ((cy - c.panY) * z) / c.zoom,
      };
    });
  }, []);

  /* Initial camera settle (glides from the zoomed-out start to the fit) */
  useEffect(() => {
    const t = setTimeout(() => fitRef.current(), 60);
    return () => clearTimeout(t);
  }, []);

  /* Wheel: zoom toward cursor (non-passive so page scroll never fires) */
  useEffect(() => {
    const el = vp.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomBy(e.deltaY < 0 ? 1.08 : 0.92, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /* ---------- pan / inertia ---------- */

  const panDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    cancelAnimationFrame(raf.current);
    panData.current = {
      sx: e.clientX,
      sy: e.clientY,
      px: cam.panX,
      py: cam.panY,
    };
    vel.current = { x: 0, y: 0 };
    last.current = { x: e.clientX, y: e.clientY, t: performance.now() };
    setDrag(true);
    setGlide(false);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const panMove = (e: React.PointerEvent) => {
    const d = panData.current;
    if (!d) return;
    const now = performance.now();
    const dt = Math.max(1, now - last.current.t);
    vel.current = {
      x: ((e.clientX - last.current.x) / dt) * 16,
      y: ((e.clientY - last.current.y) / dt) * 16,
    };
    last.current = { x: e.clientX, y: e.clientY, t: now };
    setCam((c) => ({
      ...c,
      panX: d.px + e.clientX - d.sx,
      panY: d.py + e.clientY - d.sy,
    }));
  };

  const panUp = () => {
    if (!panData.current) return;
    panData.current = null;
    setDrag(false);
    const v = { ...vel.current };
    if (Math.abs(v.x) + Math.abs(v.y) > 2) {
      setGlide(true);
      const step = () => {
        v.x *= 0.93;
        v.y *= 0.93;
        if (Math.abs(v.x) + Math.abs(v.y) < 0.4) {
          setGlide(false);
          return;
        }
        setCam((c) => ({ ...c, panX: c.panX + v.x, panY: c.panY + v.y }));
        raf.current = requestAnimationFrame(step);
      };
      raf.current = requestAnimationFrame(step);
    }
  };

  /* ---------- node drag / select ---------- */

  const nodeDown = (e: React.PointerEvent, n: CanvasNode) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    nd.current = {
      id: n.id,
      sx: e.clientX,
      sy: e.clientY,
      cx: n.cx,
      cy: n.cy,
      moved: false,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const nodeMove = (e: React.PointerEvent) => {
    const d = nd.current;
    if (!d) return;
    const dxs = e.clientX - d.sx;
    const dys = e.clientY - d.sy;
    if (!d.moved && Math.abs(dxs) + Math.abs(dys) > 4) {
      d.moved = true;
      setDragId(d.id);
    }
    if (!d.moved) return;
    const z = cam.zoom;
    let px: number, py: number;
    if (tiltRef.current) {
      /* screen → plane deltas (handoff 3D math) */
      const u = dxs / z;
      const v = dys / (z * COS_TILT);
      px = (u + v) / SQRT2;
      py = (v - u) / SQRT2;
    } else {
      px = dxs / z;
      py = dys / z;
    }
    setPos((p) => ({
      ...p,
      [d.id]: { cx: d.cx + px, cy: d.cy + py },
    }));
  };

  const nodeUp = () => {
    const d = nd.current;
    nd.current = null;
    if (!d) return;
    if (!d.moved) {
      onNodeClick?.(d.id);
      centerOn(d.id);
    }
    setDragId(null);
  };

  const toggle3d = useCallback(() => {
    const next = !tiltRef.current;
    tiltRef.current = next;
    setTilt(next);
    setTimeout(() => fitRef.current(), 20);
  }, []);

  /* Keyboard shortcuts: +/− zoom, F fit, T tilt */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey)
        return;
      if (e.key === "+" || e.key === "=") zoomBy(1.2);
      else if (e.key === "-" || e.key === "_") zoomBy(0.83);
      else if (e.key === "f" || e.key === "F") fitRef.current();
      else if (e.key === "t" || e.key === "T") toggle3d();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomBy, toggle3d]);

  const worldTrans =
    drag || glide ? "transform 0s" : "transform .55s cubic-bezier(.22,1,.36,1)";
  const tiltT = tilt ? "rotateX(55deg) rotateZ(45deg)" : "none";
  /* The trailing translateZ lifts each billboard toward the camera so the
     tilted plane can't clip it (true 3D intersection inside preserve-3d). */
  const billT = tilt
    ? "rotateZ(-45deg) rotateX(-55deg) translateZ(110px)"
    : "none";

  return (
    <div className="absolute inset-0 overflow-hidden bg-vpbg">
      {/* viewport — the pan/zoom surface. The zoom cluster lives OUTSIDE
          this element: its pointer capture would otherwise swallow button
          clicks, and backdrop-filter inside a perspective context makes
          Chrome flicker. */}
      <div
        ref={vp}
        onPointerDown={panDown}
        onPointerMove={panMove}
        onPointerUp={panUp}
        className="absolute inset-0"
        style={{
          cursor: drag ? "grabbing" : "grab",
          touchAction: "none",
          perspective: "1800px",
          perspectiveOrigin: "50% 38%",
        }}
      >
        {/* world */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: layout.w,
          height: layout.h,
          transform: `translate(${cam.panX}px, ${cam.panY}px) scale(${cam.zoom})`,
          transition: worldTrans,
          transformOrigin: "0 0",
          transformStyle: "preserve-3d",
        }}
      >
        {/* infinite dot-grid plane (kept at the monitor's 8000×6000 — larger
            layers exceed GPU texture limits at 2x DPR and shimmer) */}
        <div
          style={{
            position: "absolute",
            left: ox - 4000,
            top: oy - 3000,
            width: 8000,
            height: 6000,
            backgroundColor: "var(--plane)",
            backgroundImage:
              "radial-gradient(var(--dot) 1.2px, transparent 1.6px)",
            backgroundSize: "24px 24px",
            transform: tiltT,
            transformOrigin: "4000px 3000px",
            transition: worldTrans,
            pointerEvents: "none",
          }}
        />

        {/* content layer (tilted with the plane) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: tiltT,
            transformOrigin: `${ox}px ${oy}px`,
            transition: worldTrans,
            transformStyle: "preserve-3d",
          }}
        >
          {/* edges */}
          <svg
            className="pointer-events-none absolute inset-0"
            style={{ overflow: "visible" }}
            width={1}
            height={1}
          >
            {edges.map((e) => (
              <g key={e.key}>
                <path
                  d={e.d}
                  fill="none"
                  stroke="var(--edge)"
                  strokeWidth={1.5}
                />
                <path
                  d={e.d}
                  fill="none"
                  stroke="var(--driftc)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeDasharray="3 23"
                  style={{ animation: "ddrift 1.5s linear infinite" }}
                />
              </g>
            ))}
          </svg>

          <PulseLayer edges={edges} cycle={cycle} />

          {/* edge label pills — billboarded so text stays face-on in 3D */}
          {edges
            .filter((e) => e.label)
            .map((e) => (
              <div
                key={`l${e.key}`}
                className="pointer-events-none absolute"
                style={{
                  left: e.mx,
                  top: e.my,
                  transformStyle: "preserve-3d",
                }}
              >
                <div
                  style={{
                    transform: billT,
                    transformOrigin: "0 0",
                    transition: worldTrans,
                  }}
                >
                  <div className="max-w-[180px] -translate-x-1/2 -translate-y-1/2 truncate rounded-full border border-line bg-pill px-2.5 py-[3px] text-[10px] font-semibold text-t2 shadow-[0_4px_14px_var(--shade)]">
                    {e.label}
                  </div>
                </div>
              </div>
            ))}

          {/* pucks */}
          {nodes.map((n, i) => {
            const selected = selectedId === n.id;
            const dragging = dragId === n.id;
            const tileShadow =
              (selected || dragging ? `0 0 0 2.5px var(--ringc), ` : "") +
              `0 5px 0 color-mix(in oklab, ${n.color} 55%, #000000), 0 12px 22px var(--ambient), 0 6px 16px color-mix(in srgb, ${n.color} 20%, transparent)`;
            const pop = dragging
              ? { scale: 1.14, y: -6 }
              : selected
                ? { scale: 1.07, y: -3 }
                : { scale: 1, y: 0 };
            return (
              <div
                key={n.id}
                onPointerDown={(e) => nodeDown(e, n)}
                onPointerMove={nodeMove}
                onPointerUp={nodeUp}
                style={{
                  position: "absolute",
                  left: n.cx - NODE_HALF,
                  top: n.cy - 32,
                  width: 140,
                  cursor: "pointer",
                  touchAction: "none",
                  transformStyle: "preserve-3d",
                }}
              >
                {/* ground shadow — sits on the plane, not billboarded */}
                <div
                  style={{
                    position: "absolute",
                    left: 33,
                    top: 18,
                    width: 74,
                    height: 28,
                    background:
                      "radial-gradient(ellipse, var(--shade) 0%, transparent 70%)",
                    filter: "blur(3px)",
                    opacity: tilt ? 1 : 0,
                    transition: "opacity .4s ease",
                  }}
                />
                {/* billboard: counter-rotates to face the camera. Entrance
                    fade lives HERE (leaf of the 3D chain) — animated
                    opacity on an ancestor would flatten preserve-3d. */}
                <div
                  style={{
                    transform: billT,
                    transformOrigin: "70px 32px",
                    transition: worldTrans,
                    animation: `fadeIn .6s ease ${(0.3 + Math.min(i, 12) * 0.06).toFixed(2)}s both`,
                  }}
                >
                  <motion.div
                    animate={pop}
                    whileHover={{ scale: 1.08, y: -3 }}
                    whileTap={{ scale: 0.96 }}
                    transition={{ duration: 0.18, ease: POP_EASE }}
                    className="flex flex-col items-center gap-2"
                  >
                    <div
                      className="relative size-16"
                      style={{
                        animation: `floaty 4s ease-in-out ${((i % 8) * 0.4).toFixed(2)}s infinite`,
                      }}
                    >
                      <div
                        className="absolute inset-0 flex items-center justify-center rounded-node border border-white/40 font-mono text-[15px] font-extrabold tracking-[.3px] text-white"
                        style={{
                          background: `linear-gradient(180deg, color-mix(in oklab, ${n.color} 78%, #ffffff) 0%, ${n.color} 55%, color-mix(in oklab, ${n.color} 80%, #000000) 100%)`,
                          boxShadow: tileShadow,
                          textShadow: "0 1px 2px rgba(0,0,0,.3)",
                          transition: "box-shadow .18s ease",
                        }}
                      >
                        {n.glyph}
                      </div>
                      {n.hasFilter && (
                        <div
                          title={n.filterName || "Filter"}
                          className="absolute -right-[3px] -top-[3px] size-3 rounded-full border-2 border-plane"
                          style={{
                            background: "#f59e0b",
                            boxShadow: "0 0 8px #f59e0b",
                          }}
                        />
                      )}
                      {n.hasErrorHandler && (
                        <div
                          title="Error handler"
                          className="absolute -bottom-[3px] -right-[3px] size-3 rounded-full border-2 border-plane"
                          style={{
                            background: "#ef4444",
                            boxShadow: "0 0 8px #ef4444",
                          }}
                        />
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-[3px]">
                      <div
                        className="max-w-[220px] truncate whitespace-nowrap rounded-full bg-pill px-3 py-1 text-[13px] font-semibold text-t1"
                        style={{
                          border: `1px solid ${selected ? "var(--ringc)" : "var(--line)"}`,
                          boxShadow: "0 4px 14px var(--shade)",
                        }}
                      >
                        {n.label}
                      </div>
                      <div className="max-w-[200px] truncate whitespace-nowrap text-[10.5px] text-t2">
                        {appName(n.app)}
                        {n.hasFilter && (
                          <span className="text-warn"> · filtered</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      </div>

      {/* zoom cluster — sibling of the pan surface so clicks always land */}
      <TooltipProvider delayDuration={400}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-4 left-4 z-[2] flex flex-col items-center gap-1.5"
        >
          <ClusterButton label="Zoom in (+)" onClick={() => zoomBy(1.2)}>
            <Plus className="size-4" />
          </ClusterButton>
          <ClusterButton label="Zoom out (−)" onClick={() => zoomBy(0.83)}>
            <Minus className="size-4" />
          </ClusterButton>
          <ClusterButton label="Fit to view (F)" onClick={fit}>
            <Maximize2 className="size-3.5" />
          </ClusterButton>
          <ClusterButton
            label={tilt ? "Switch to 2D (T)" : "Switch to 3D (T)"}
            onClick={toggle3d}
            active={tilt}
          >
            <span className="text-[10px] font-bold">{tilt ? "2D" : "3D"}</span>
          </ClusterButton>
          <span className="tabular mt-0.5 font-mono text-[9px] text-t3">
            {Math.round(cam.zoom * 100)}%
          </span>
        </motion.div>
      </TooltipProvider>
    </div>
  );
}
