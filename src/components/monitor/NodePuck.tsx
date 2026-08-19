"use client";

import { motion } from "framer-motion";
import { onColorGradient } from "@/lib/apps";
import { fmtMs, ST, type MonitorNode, type NodeStatus } from "./data";

const POP_EASE = [0.34, 1.56, 0.64, 1] as const;

export function NodePuck({
  node,
  index,
  status,
  selected,
  dragging,
  tilt,
  billT,
  worldTrans,
  ring,
  ambient,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onActivate,
}: {
  node: MonitorNode;
  index: number;
  status: NodeStatus;
  selected: boolean;
  dragging: boolean;
  tilt: boolean;
  billT: string;
  worldTrans: string;
  ring: string;
  ambient: string;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onActivate?: () => void;
}) {
  const sc = ST[status];
  const col = node.col;
  const dark55 = `color-mix(in oklab, ${col} 55%, #000000)`;
  const tileShadow =
    (selected || dragging ? `0 0 0 2.5px ${ring}, ` : "") +
    `0 5px 0 ${dark55}, 0 12px 22px ${ambient}, 0 6px 16px color-mix(in srgb, ${col} 20%, transparent)`;

  const pop = dragging
    ? { scale: 1.14, y: -6 }
    : selected
      ? { scale: 1.07, y: -3 }
      : { scale: 1, y: 0 };

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${node.name}, ${node.sub}, ${sc.label}`}
      style={{
        position: "absolute",
        left: node.cx - 70,
        top: node.cy - 32,
        width: 140,
        cursor: "pointer",
        touchAction: "none",
        transformStyle: "preserve-3d",
      }}
    >
      {/* ground shadow — sits on the plane, not billboarded */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 33,
          top: 18,
          width: 74,
          height: 28,
          background: "radial-gradient(ellipse, var(--shade) 0%, transparent 70%)",
          filter: "blur(3px)",
          opacity: tilt ? 1 : 0,
          transition: "opacity .4s ease",
        }}
      />
      {/* billboard: counter-rotates so the puck always faces the camera.
          Entrance fade lives here (leaf of the 3D chain) as a CSS animation —
          animated opacity on any ancestor would flatten preserve-3d. */}
      <div
        style={{
          transform: billT,
          transformOrigin: "70px 32px",
          transition: worldTrans,
          animation: `fadeIn .6s ease ${(0.1 + index * 0.06).toFixed(2)}s both`,
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
              animation: `floaty 4s ease-in-out ${(index * 0.4).toFixed(2)}s infinite`,
            }}
          >
            <div
              className="absolute inset-0 flex items-center justify-center rounded-node border border-white/40 font-mono text-[15px] font-extrabold tracking-[.3px] text-white"
              style={{
                background: onColorGradient(col),
                boxShadow: tileShadow,
                textShadow: "0 1px 2px rgba(0,0,0,.3)",
                transition: "box-shadow .18s ease",
              }}
            >
              {node.icon}
            </div>
            <div
              aria-hidden="true"
              className="absolute -right-[3px] -top-[3px] size-3 rounded-full border-2 border-plane"
              style={{
                background: sc.dot,
                boxShadow: `0 0 8px ${sc.dot}`,
                animation: status === "ok" || status === "off" ? "none" : "blinkdot 1.3s infinite",
              }}
            />
          </div>
          <div className="flex flex-col items-center gap-[3px]">
            <div
              className="whitespace-nowrap rounded-full bg-pill px-3 py-1 text-[13px] font-semibold text-t1"
              style={{
                border: `1px solid ${selected ? ring : status === "ok" ? "var(--line)" : sc.dot}`,
                boxShadow: "0 4px 14px var(--shade)",
              }}
            >
              {node.name}
            </div>
            <div className="whitespace-nowrap text-[10.5px] text-t2">
              {node.sub} ·{" "}
              <span
                className="font-mono"
                style={{ color: status === "ok" ? "var(--t2)" : sc.color }}
              >
                {node.msLabel || fmtMs(node.ms)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
