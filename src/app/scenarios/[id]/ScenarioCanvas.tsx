"use client";

import { useRef, useEffect } from "react";
import * as d3 from "d3";
import type { ModuleInfo, Connection } from "../../lib/api";

interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  module: string;
  app: string;
  label: string;
  hasFilter: boolean;
  filterName: string | null;
  hasErrorHandler: boolean;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  source: SimNode;
  target: SimNode;
  label?: string;
}

const NODE_W = 240;
const NODE_H = 68;
const NODE_RX = 12;
const FIT_PADDING = 60;

function nodeColor(d: SimNode): string {
  if (d.module.toLowerCase().includes("router")) return "var(--success)";
  if (d.hasErrorHandler) return "var(--danger)";
  if (d.hasFilter) return "var(--warning)";
  return "var(--primary)";
}

export default function ScenarioCanvas({
  modules,
  connections,
  onNodeClick,
}: {
  modules: ModuleInfo[];
  connections: Connection[];
  onNodeClick?: (moduleId: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || modules.length === 0) return;

    // Clear previous render
    d3.select(container).selectAll("*").remove();

    const width = container.clientWidth;
    const height = container.clientHeight;

    // Build nodes — pin all nodes
    const nodes: SimNode[] = modules.map((m, i) => {
      const hasPos = m.x != null && m.y != null;
      const x = hasPos ? m.x! : (i % 4) * 300;
      const y = hasPos ? m.y! : Math.floor(i / 4) * 120;
      return {
        id: m.id,
        module: m.module,
        app: m.app,
        label: m.label || m.module,
        hasFilter: m.hasFilter,
        filterName: m.filterName,
        hasErrorHandler: m.hasErrorHandler,
        x,
        y,
        fx: x,
        fy: y,
      };
    });

    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    // Build links
    const links: SimLink[] = connections
      .filter((c) => nodeById.has(c.from) && nodeById.has(c.to))
      .map((c) => ({
        source: nodeById.get(c.from)!,
        target: nodeById.get(c.to)!,
        label: c.label,
      }));

    // SVG setup
    const svg = d3
      .select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("display", "block");

    // Arrow marker
    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", "arrowhead")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-4L10,0L0,4")
      .attr("fill", "var(--muted)");

    // Drop shadow filter
    const filter = defs
      .append("filter")
      .attr("id", "node-shadow")
      .attr("x", "-10%")
      .attr("y", "-10%")
      .attr("width", "120%")
      .attr("height", "130%");
    filter
      .append("feDropShadow")
      .attr("dx", 0)
      .attr("dy", 2)
      .attr("stdDeviation", 3)
      .attr("flood-opacity", 0.08);

    // Zoom group
    const g = svg.append("g");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => g.attr("transform", e.transform));

    svg.call(zoom);

    // --- Fit-to-view helper ---
    function fitView(animate = false) {
      if (nodes.length === 0) return;
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const n of nodes) {
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        if (nx < minX) minX = nx;
        if (ny < minY) minY = ny;
        if (nx + NODE_W > maxX) maxX = nx + NODE_W;
        if (ny + NODE_H > maxY) maxY = ny + NODE_H;
      }
      const bw = maxX - minX;
      const bh = maxY - minY;
      const scale = Math.min(
        (width - FIT_PADDING * 2) / bw,
        (height - FIT_PADDING * 2) / bh,
        1.2 // don't zoom in too much on small graphs
      );
      const tx = width / 2 - (minX + bw / 2) * scale;
      const ty = height / 2 - (minY + bh / 2) * scale;
      const t = d3.zoomIdentity.translate(tx, ty).scale(scale);
      if (animate) {
        svg.transition().duration(400).call(zoom.transform, t);
      } else {
        svg.call(zoom.transform, t);
      }
    }

    // Connection lines — curved paths
    const linkSel = g
      .append("g")
      .selectAll<SVGPathElement, SimLink>("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", "var(--muted)")
      .attr("stroke-width", 2)
      .attr("stroke-opacity", 0.5)
      .attr("marker-end", "url(#arrowhead)");

    // Edge labels for links with labels
    const labeledLinks = links.filter((l) => l.label);
    const edgeLabelSel = g
      .append("g")
      .selectAll<SVGGElement, SimLink>("g")
      .data(labeledLinks)
      .join("g");

    edgeLabelSel
      .append("rect")
      .attr("rx", 6)
      .attr("fill", "var(--card)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);

    edgeLabelSel
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "var(--muted)")
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .text((d) => {
        const t = d.label || "";
        return t.length > 20 ? t.slice(0, 18) + "…" : t;
      });

    function updateLinkPaths() {
      linkSel.attr("d", (d) => {
        const sx = (d.source.x ?? 0) + NODE_W / 2;
        const sy = (d.source.y ?? 0) + NODE_H / 2;
        const tx = (d.target.x ?? 0) + NODE_W / 2;
        const ty = (d.target.y ?? 0) + NODE_H / 2;
        const dx = tx - sx;
        const dy = ty - sy;
        // Slight curve
        const cx = sx + dx / 2;
        const cy = sy + dy / 2 - Math.abs(dx) * 0.08;
        return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
      });

      // Reposition edge labels at midpoint of the curve
      edgeLabelSel.each(function (d) {
        const sx = (d.source.x ?? 0) + NODE_W / 2;
        const sy = (d.source.y ?? 0) + NODE_H / 2;
        const tx = (d.target.x ?? 0) + NODE_W / 2;
        const ty = (d.target.y ?? 0) + NODE_H / 2;
        const dx = tx - sx;
        const mx = sx + dx / 2;
        const my = sy + (ty - sy) / 2 - Math.abs(dx) * 0.08;

        const group = d3.select(this);
        const textEl = group.select("text");
        textEl.attr("x", mx).attr("y", my);

        const bbox = (textEl.node() as SVGTextElement).getBBox();
        const px = 6, py = 3;
        group
          .select("rect")
          .attr("x", bbox.x - px)
          .attr("y", bbox.y - py)
          .attr("width", bbox.width + px * 2)
          .attr("height", bbox.height + py * 2);
      });
    }

    // Node groups — track drag to distinguish click vs drag
    let dragMoved = false;

    const nodeSel = g
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(
        d3
          .drag<SVGGElement, SimNode>()
          .on("start", (event, d) => {
            dragMoved = false;
            if (!event.active) simulation.alphaTarget(0.05).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            dragMoved = true;
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = event.x;
            d.fy = event.y;
          })
      )
      .on("click", (_event, d) => {
        if (!dragMoved && onNodeClick) {
          onNodeClick(d.id);
        }
      });

    // Node rect with shadow
    nodeSel
      .append("rect")
      .attr("width", NODE_W)
      .attr("height", NODE_H)
      .attr("rx", NODE_RX)
      .attr("fill", "var(--card)")
      .attr("stroke", (d) => nodeColor(d))
      .attr("stroke-width", 1.5)
      .attr("filter", "url(#node-shadow)");

    // Colored left accent bar
    nodeSel
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", 4)
      .attr("height", NODE_H)
      .attr("rx", 2)
      .attr("fill", (d) => nodeColor(d))
      .attr("clip-path", `inset(0 0 0 0 round ${NODE_RX}px)`);

    // Label text
    nodeSel
      .append("text")
      .attr("x", 16)
      .attr("y", 28)
      .attr("fill", "var(--foreground)")
      .attr("font-size", 14)
      .attr("font-weight", 600)
      .text((d) => {
        const t = d.label;
        return t.length > 28 ? t.slice(0, 26) + "…" : t;
      });

    // Subtext (app / module type)
    nodeSel
      .append("text")
      .attr("x", 16)
      .attr("y", 48)
      .attr("fill", "var(--muted)")
      .attr("font-size", 11)
      .attr("font-family", "ui-monospace, monospace")
      .text((d) => {
        const t = d.app || d.module;
        return t.length > 32 ? t.slice(0, 30) + "…" : t;
      });

    // Badge: filter
    nodeSel
      .filter((d) => d.hasFilter)
      .append("rect")
      .attr("x", NODE_W - 54)
      .attr("y", 6)
      .attr("width", 44)
      .attr("height", 18)
      .attr("rx", 4)
      .attr("fill", "var(--warning)")
      .attr("opacity", 0.15);

    nodeSel
      .filter((d) => d.hasFilter)
      .append("text")
      .attr("x", NODE_W - 32)
      .attr("y", 18)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--warning)")
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .text((d) => d.filterName || "Filter");

    // Badge: error handler
    nodeSel
      .filter((d) => d.hasErrorHandler)
      .append("rect")
      .attr("x", NODE_W - 54)
      .attr("y", NODE_H - 24)
      .attr("width", 44)
      .attr("height", 18)
      .attr("rx", 4)
      .attr("fill", "var(--danger)")
      .attr("opacity", 0.15);

    nodeSel
      .filter((d) => d.hasErrorHandler)
      .append("text")
      .attr("x", NODE_W - 32)
      .attr("y", NODE_H - 11)
      .attr("text-anchor", "middle")
      .attr("fill", "var(--danger)")
      .attr("font-size", 10)
      .attr("font-weight", 500)
      .text("Error");

    // Force simulation — nodes start pinned, only used for drag updates
    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(180)
      )
      .force("collision", d3.forceCollide(NODE_W / 2 + 20))
      .alphaDecay(0.4)
      .on("tick", () => {
        updateLinkPaths();
        nodeSel.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

    // Initial fit only — remove listener after first fire so drags don't re-fit
    simulation.on("end.fit", () => {
      fitView(false);
      simulation.on("end.fit", null);
    });
    // Also fit immediately for pinned layouts
    requestAnimationFrame(() => fitView(false));

    // --- Fit View button ---
    const btnSize = 32;
    const btnGroup = svg
      .append("g")
      .attr("transform", `translate(${width - btnSize - 12}, 12)`)
      .attr("cursor", "pointer")
      .on("click", () => fitView(true));

    btnGroup
      .append("rect")
      .attr("width", btnSize)
      .attr("height", btnSize)
      .attr("rx", 8)
      .attr("fill", "var(--card)")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1);

    // Expand icon
    btnGroup
      .append("path")
      .attr(
        "d",
        "M10,8 L8,8 L8,12 L12,12 L12,10 M22,8 L24,8 L24,12 L20,12 L20,10 M10,24 L8,24 L8,20 L12,20 L12,22 M22,24 L24,24 L24,20 L20,20 L20,22"
      )
      .attr("transform", "translate(0, 0) scale(1)")
      .attr("fill", "none")
      .attr("stroke", "var(--foreground)")
      .attr("stroke-width", 1.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    // Simpler icon: crosshair / maximize
    btnGroup.select("path").remove();
    btnGroup
      .append("text")
      .attr("x", btnSize / 2)
      .attr("y", btnSize / 2 + 1)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "var(--foreground)")
      .attr("font-size", 16)
      .text("⤢");

    return () => {
      simulation.stop();
    };
  }, [modules, connections]);

  return (
    <div
      ref={containerRef}
      className="bg-card border border-border rounded-xl overflow-hidden relative"
      style={{ height: "calc(100vh - 300px)", minHeight: 400 }}
    />
  );
}
