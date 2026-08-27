"use client";

import { motion } from "framer-motion";
import { ST } from "./data";

export function WorkflowChip({ incident }: { incident: boolean }) {
  const st = incident ? ST.err : ST.warn;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.35 }}
      className="pointer-events-none absolute left-[276px] top-3 z-[2] flex items-center gap-2.5 rounded-[10px] border border-line bg-glass px-[13px] py-2 shadow-[0_6px_18px_var(--shade)] backdrop-blur-[12px]"
    >
      <div
        aria-hidden="true"
        className="size-[7px] rounded-full"
        style={{ background: st.dot, boxShadow: `0 0 8px ${st.dot}` }}
      />
      <div className="text-[13.5px] font-semibold">Lead Capture → Nurture</div>
      <div
        className="rounded-full border px-2 py-[2px] text-[11px] font-semibold"
        style={{ color: st.color, borderColor: st.border }}
      >
        {incident ? "Incident" : "Degraded"}
      </div>
      <div aria-hidden="true" className="h-3.5 w-px bg-line" />
      <div className="font-mono text-[10.5px] text-t3">last run 18s ago · v2.4</div>
    </motion.div>
  );
}
