"use client";

import { motion } from "framer-motion";
import { ChevronDown, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ST, WFS } from "./data";

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-px">
      <div className="text-[10px] text-t3">{label}</div>
      <div
        className="tabular text-[13px] font-semibold"
        style={color ? { color } : undefined}
      >
        {value}
      </div>
    </div>
  );
}

export function MonitorHeader({
  incident,
  clientView,
  ops,
  errors,
  paused,
  dark,
  onToggleTheme,
}: {
  incident: boolean;
  clientView: boolean;
  ops: number;
  errors: number;
  paused: boolean;
  dark: boolean;
  onToggleTheme: () => void;
}) {
  const liveColor = paused ? "#f59e0b" : "#22c55e";
  return (
    <header className="z-[5] flex items-center gap-3.5 border-b border-line bg-panel px-4 backdrop-blur-[14px]">
      {/* logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex size-5 rotate-45 items-center justify-center rounded-[6px] bg-t1">
          <div className="size-1.5 rounded-full bg-bg" />
        </div>
        <div className="text-[16px] font-bold tracking-[-0.3px]">rippit</div>
        <div className="mt-px text-[11px] text-t3">Monitor</div>
      </div>

      <div className="h-[18px] w-px bg-line" />

      {/* workflow switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger className="group flex cursor-pointer items-center gap-2 outline-none">
          <span className="text-[12.5px] font-semibold">
            Lead Capture → Nurture
          </span>
          <ChevronDown className="size-3 text-t3 transition-transform group-data-[state=open]:rotate-180" />
          <span className="rounded-[5px] border border-line bg-hover px-[7px] py-[2px] text-[10px] text-t2">
            Production
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="border-line bg-pill min-w-[220px]"
        >
          {WFS.map((w) => (
            <DropdownMenuItem key={w.name} className="gap-2 text-[12px]">
              <span
                className="size-[7px] rounded-full"
                style={{
                  background: ST[w.st].dot,
                  boxShadow: `0 0 6px ${ST[w.st].dot}`,
                }}
              />
              <span className="flex-1 font-medium">{w.name}</span>
              <span className="font-mono text-[9.5px] text-t3">{w.ops}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex-1" />

      {incident && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-[7px] rounded-full border border-[rgba(239,68,68,.35)] bg-[rgba(239,68,68,.1)] px-3 py-[5px]"
        >
          <div
            className="size-1.5 rounded-full bg-err"
            style={{ animation: "blinkdot 1.2s infinite" }}
          />
          <div className="text-[11px] font-medium text-[#f87171]">
            Incident — SMS Welcome failing · 47 errors / 30m
          </div>
        </motion.div>
      )}

      {clientView && (
        <div className="rounded-full border border-line bg-hover px-2.5 py-1 text-[10.5px] font-semibold">
          Client view
        </div>
      )}

      {/* stat chips */}
      <div className="flex items-center gap-4 px-1">
        <Stat label="Ops today" value={ops.toLocaleString("en-US")} />
        <div className="h-[22px] w-px bg-line2" />
        <Stat
          label="Errors"
          value={String(errors)}
          color={errors > 20 ? "#ef4444" : "#f59e0b"}
        />
        <div className="h-[22px] w-px bg-line2" />
        <Stat label="Avg run" value="6.4s" />
      </div>

      {/* live badge */}
      <div className="flex items-center gap-[7px] rounded-full border border-line bg-hover px-3 py-[5px]">
        <div
          className="size-[7px] rounded-full"
          style={{
            background: liveColor,
            boxShadow: `0 0 8px ${liveColor}`,
            animation: "blinkdot 1.6s infinite",
          }}
        />
        <div className="text-[11px] font-semibold text-t2">
          {paused ? "Paused" : "Live"}
        </div>
      </div>

      {/* theme toggle */}
      <button
        onClick={onToggleTheme}
        title="Toggle light / dark"
        className="flex size-[30px] cursor-pointer items-center justify-center rounded-control border border-line bg-hover text-t2 transition-colors hover:border-t1 hover:text-t1"
      >
        {dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </button>

      <Button
        size="sm"
        className="h-auto cursor-pointer rounded-control px-3.5 py-[7px] text-[12px] font-semibold hover:opacity-85"
      >
        Share view
      </Button>
    </header>
  );
}
