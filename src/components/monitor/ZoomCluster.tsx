"use client";

import { motion } from "framer-motion";
import { Maximize2, Minus, Pause, Play, Plus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ClusterButton({
  label,
  onClick,
  active,
  warn,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  warn?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className="flex size-8 cursor-pointer items-center justify-center rounded-control border text-[14px] backdrop-blur-[8px] transition-colors hover:border-t1"
          style={{
            background: active ? "var(--text)" : "var(--glass)",
            borderColor: active ? "var(--text)" : "var(--line-strong)",
            color: active ? "var(--bg)" : warn ? "var(--warn-text)" : "var(--t2)",
          }}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-[12px]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function ZoomCluster({
  tilt,
  paused,
  onZoomIn,
  onZoomOut,
  onFit,
  onToggle3d,
  onTogglePause,
}: {
  tilt: boolean;
  paused: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggle3d: () => void;
  onTogglePause: () => void;
}) {
  return (
    <TooltipProvider delayDuration={400}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="absolute bottom-32 left-[276px] z-[2] flex flex-col gap-1.5"
      >
        <ClusterButton label="Zoom in" onClick={onZoomIn}>
          <Plus className="size-4" />
        </ClusterButton>
        <ClusterButton label="Zoom out" onClick={onZoomOut}>
          <Minus className="size-4" />
        </ClusterButton>
        <ClusterButton label="Fit to view" onClick={onFit}>
          <Maximize2 className="size-3.5" />
        </ClusterButton>
        <ClusterButton
          label={tilt ? "Switch to 2D" : "Switch to 3D"}
          onClick={onToggle3d}
          active={tilt}
        >
          <span className="text-[11px] font-bold">{tilt ? "2D" : "3D"}</span>
        </ClusterButton>
        <ClusterButton
          label={paused ? "Resume" : "Pause"}
          onClick={onTogglePause}
          warn={paused}
        >
          {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        </ClusterButton>
      </motion.div>
    </TooltipProvider>
  );
}
