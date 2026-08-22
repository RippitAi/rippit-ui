import type { Connection, ModuleInfo, NodeId } from "@/app/lib/api";
import type { ProviderId, UnifiedGroup } from "@/lib/connectors/types";

/*
 * Canvas layout — pure functions shared by the workflow canvas and the
 * system map. Geometry from the v2 handoff: 176px columns, 124px rows,
 * 120/110 margins, 46px nodes.
 *
 * Layered left-to-right layout computed from the connection graph.
 * Make.com designer coordinates are ignored on purpose — real blueprints
 * scatter modules across thousands of pixels, which forces the fit zoom so
 * far out that pucks and edges become unreadable. GHL workflows carry no
 * coordinates at all, so the graph is the only source of truth.
 */

export const COL_W = 176;
export const ROW_H = 124;
export const MARGIN_X = 120;
export const MARGIN_Y = 110;
export const COMP_GAP = 70;
export const NODE = 46;
/** Node wrapper (puck + label column) is 132 wide, centred on cx. */
export const NODE_HALF = 66;
/** Portal chips sit this far right of their anchor step. */
export const PORTAL_DX = 100;
export const PORTAL_W = 160;

/* Group container paddings around a group's node bounding box. */
const GROUP_PAD_X = 70;
const GROUP_PAD_TOP = 64;
const GROUP_PAD_BOTTOM = 48;
const GROUP_GAP = 120;

/* Edge kinds that must not shape the layered layout: goto is a loop back-edge
   (would corrupt Kahn columns); the cross-system kinds connect separate
   workflow groups that lay out independently. All are still rendered. */
export const CROSS_KINDS = new Set(["webhook-call", "api-call", "subflow"]);
/* "Both touch the same asset" edges (unified map) — informational, dotted,
   never laid out or pulsed. */
export const ASSET_KINDS = new Set(["shared-asset"]);
export const NON_LAYOUT_KINDS = new Set(["goto", ...CROSS_KINDS, ...ASSET_KINDS]);

export interface NodePos {
  cx: number;
  cy: number;
  col: number;
}

export interface GroupBox {
  id: string;
  name: string;
  source: ProviderId;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  posOf: Map<NodeId, NodePos>;
  maxCol: number;
  w: number;
  h: number;
  groupBoxes: GroupBox[];
}

export interface Spacing {
  colW: number;
  rowH: number;
  marginX: number;
  marginY: number;
  compGap: number;
}
const DEFAULT_SPACING: Spacing = { colW: COL_W, rowH: ROW_H, marginX: MARGIN_X, marginY: MARGIN_Y, compGap: COMP_GAP };

function layoutGraph(modules: ModuleInfo[], connections: Connection[], sp: Spacing = DEFAULT_SPACING) {
  const { colW: COL_W, rowH: ROW_H, marginX: MARGIN_X, marginY: MARGIN_Y, compGap: COMP_GAP } = sp;
  const ids = modules.map((m) => m.id);
  const idSet = new Set(ids);
  /* Only goto (loop back-edges) is excluded from layering — cross-kind edges
     participate so portal chips sit right after their anchor step. Grouped
     mode never passes cross-group edges here. */
  const conns = connections.filter(
    (c) => idSet.has(c.from) && idSet.has(c.to) && c.from !== c.to && c.kind !== "goto"
  );

  const out = new Map<NodeId, NodeId[]>();
  const parents = new Map<NodeId, NodeId[]>();
  const indeg = new Map<NodeId, number>();
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
  const col = new Map<NodeId, number>();
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
  const comp = new Map<NodeId, number>();
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

  const posOf = new Map<NodeId, NodePos>();
  const row = new Map<NodeId, number>();
  let yOffset = 0;

  for (let ci = 0; ci < compCount; ci++) {
    const members = ids.filter((id) => comp.get(id) === ci);
    const byCol = new Map<number, NodeId[]>();
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
        const bary = ps.length ? ps.reduce((s: number, p) => s + row.get(p)!, 0) / ps.length : i;
        return { id, bary, i };
      });
      keyed.sort((a, b) => a.bary - b.bary || a.i - b.i);
      keyed.forEach((k, r) => row.set(k.id, r));
      byCol.set(c, keyed.map((k) => k.id));
    }

    const compHeight = Math.max(...colKeys.map((c) => byCol.get(c)!.length), 1) * ROW_H;

    for (const c of colKeys) {
      const group = byCol.get(c)!;
      const colHeight = group.length * ROW_H;
      group.forEach((id, r) => {
        posOf.set(id, {
          cx: MARGIN_X + c * COL_W,
          cy: MARGIN_Y + yOffset + (compHeight - colHeight) / 2 + r * ROW_H,
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
    h: MARGIN_Y * 2 + Math.max(0, yOffset - COMP_GAP - ROW_H),
  };
}

/*
 * Group-aware layout. Without groups this is layoutGraph unchanged. With
 * groups (the system map), each group lays out independently with the same
 * algorithm, groups are ordered topologically over the cross-edge graph
 * (sources above targets, so cross-edges stay short), stacked vertically,
 * and each gets a container box around its nodes.
 */
export function computeLayout(
  modules: ModuleInfo[],
  connections: Connection[],
  groups?: UnifiedGroup[],
  spacing: Spacing = DEFAULT_SPACING
): Layout {
  if (!groups || groups.length === 0) {
    return { ...layoutGraph(modules, connections, spacing), groupBoxes: [] };
  }

  const groupOf = (id: NodeId): string | undefined =>
    groups.find((g) => String(id).startsWith(`${g.id}:`))?.id;

  const indeg = new Map<string, number>(groups.map((g) => [g.id, 0]));
  const out = new Map<string, string[]>(groups.map((g) => [g.id, []]));
  const seen = new Set<string>();
  for (const c of connections) {
    if (!CROSS_KINDS.has(c.kind ?? "")) continue;
    const a = groupOf(c.from);
    const b = groupOf(c.to);
    if (!a || !b || a === b || seen.has(`${a}→${b}`)) continue;
    seen.add(`${a}→${b}`);
    out.get(a)!.push(b);
    indeg.set(b, (indeg.get(b) || 0) + 1);
  }
  const ordered: string[] = [];
  const queue = groups.filter((g) => indeg.get(g.id) === 0).map((g) => g.id);
  const deg = new Map(indeg);
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const next of out.get(id)!) {
      deg.set(next, deg.get(next)! - 1);
      if (deg.get(next) === 0) queue.push(next);
    }
  }
  for (const g of groups) if (!ordered.includes(g.id)) ordered.push(g.id);

  const posOf = new Map<NodeId, NodePos>();
  const groupBoxes: GroupBox[] = [];
  let yOffset = 0;
  let maxCol = 0;
  let maxW = 0;

  for (const gid of ordered) {
    const group = groups.find((g) => g.id === gid)!;
    const members = modules.filter((m) => String(m.id).startsWith(`${gid}:`));
    if (members.length === 0) continue;
    const memberIds = new Set(members.map((m) => m.id));
    const internal = connections.filter((c) => memberIds.has(c.from) && memberIds.has(c.to));
    const sub = layoutGraph(members, internal, spacing);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [id, p] of sub.posOf) {
      posOf.set(id, { cx: p.cx, cy: p.cy + yOffset, col: p.col });
      minX = Math.min(minX, p.cx);
      maxX = Math.max(maxX, p.cx);
      minY = Math.min(minY, p.cy + yOffset);
      maxY = Math.max(maxY, p.cy + yOffset);
    }
    groupBoxes.push({
      id: gid,
      name: group.name,
      source: group.source,
      x: minX - GROUP_PAD_X,
      y: minY - GROUP_PAD_TOP,
      w: maxX - minX + GROUP_PAD_X * 2,
      h: maxY - minY + GROUP_PAD_TOP + GROUP_PAD_BOTTOM,
    });
    maxCol = Math.max(maxCol, sub.maxCol);
    maxW = Math.max(maxW, sub.w);
    yOffset += sub.h + GROUP_GAP - spacing.marginY;
  }

  return {
    posOf,
    maxCol,
    w: maxW,
    h: Math.max(spacing.rowH, yOffset - GROUP_GAP + spacing.marginY * 2),
    groupBoxes,
  };
}

/** Cubic bézier between two node centres (spec: control points at mid-x). */
export function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
}

export function worstSeverity(
  issues: { severity: "error" | "warn" | "info" }[] | undefined
): "error" | "warn" | "info" | null {
  if (!issues || issues.length === 0) return null;
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  return "info";
}

/** "2.1.3" → "3rd in route 1 after step 2" style phrase for tooltips/aria. */
export function ordinalPhrase(ordinal: string): string {
  const parts = ordinal.split(".");
  if (parts.length === 1) return `${ordinal}${ordinalSuffix(Number(ordinal))}`;
  const pos = parts[parts.length - 1];
  const branch = parts[parts.length - 2];
  const parent = parts.slice(0, -2).join(".");
  const branchKind = /^[A-Z]$/.test(branch) ? "branch" : "route";
  return `${pos}${ordinalSuffix(Number(pos))} in ${branchKind} ${branch}${parent ? ` after step ${parent}` : ""}`;
}

function ordinalSuffix(n: number): string {
  if (!Number.isFinite(n)) return "";
  const v = n % 100;
  if (v >= 11 && v <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}
