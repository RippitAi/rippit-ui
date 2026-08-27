"use client";

import { motion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Timeline({
  incident,
  errors,
}: {
  incident: boolean;
  errors: number;
}) {
  const buckets: { g: number; r: number; title: string }[] = [];
  for (let i = 0; i < 48; i++) {
    let g = Math.round(10 + 20 * Math.abs(Math.sin(i * 0.83)) + (i % 9 === 0 ? 7 : 0));
    let r = 0;
    if (i >= 38 && i <= 42) r = 3 + ((i * 7) % 9);
    if (i % 13 === 5) r = 2;
    if (incident && i >= 43) {
      r += 9;
      g = Math.max(6, g - 5);
    }
    buckets.push({ g, r, title: `${g + r} runs · ${r} failed` });
  }

  return (
    <motion.section
      aria-label="Execution timeline"
      initial={{ opacity: 0, y: 26 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
      className="absolute bottom-3 left-[276px] right-[356px] z-[3] flex h-[104px] flex-col gap-1.5 rounded-card border border-line bg-panel px-4 pb-[9px] pt-2.5 shadow-[0_12px_34px_var(--shade)] backdrop-blur-[14px]"
    >
      <div className="flex items-center gap-3.5">
        <h2 className="text-[11.5px] font-semibold text-t3">
          Executions · last 24h
        </h2>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <div aria-hidden="true" className="size-[7px] rounded-[2px] bg-ok" />
          <div className="tabular text-[11.5px] text-t2">1,272 ok</div>
        </div>
        <div className="flex items-center gap-1.5">
          <div aria-hidden="true" className="size-[7px] rounded-[2px] bg-err" />
          <div className="tabular text-[11.5px] text-t2">{errors} err</div>
        </div>
      </div>
      <div
        role="img"
        aria-label={`Execution history, last 24 hours: 1,272 succeeded, ${errors} failed${incident ? ", failures concentrated in the last two hours" : ""}`}
        className="flex flex-1 items-end gap-[3px]"
      >
        {buckets.map((b, i) => (
          <div
            key={i}
            aria-hidden="true"
            title={b.title}
            className="flex h-full flex-1 cursor-default flex-col-reverse justify-start gap-px transition-[filter] hover:brightness-150"
          >
            <div
              className="rounded-[2px]"
              style={{
                height: b.g,
                background: "color-mix(in srgb, var(--ok) 55%, transparent)",
              }}
            />
            {b.r > 0 && (
              <div
                className="rounded-[2px]"
                style={{
                  height: b.r,
                  background: "color-mix(in srgb, var(--err) 90%, transparent)",
                }}
              />
            )}
          </div>
        ))}
        <div aria-hidden="true" className="h-full w-[2px] rounded-[2px] bg-t1" />
      </div>
      <div className="flex justify-between">
        <div className="text-[10.5px] text-t3">24h ago</div>
        <div className="text-[10.5px] text-t3">12h</div>
        <div className="text-[10.5px] font-semibold text-t1">Now</div>
      </div>
    </motion.section>
  );
}
