"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HARD_LIMIT, SAFE_LIMIT, type Status } from "@/lib/attendance";

const FILL_BY_STATUS: Record<Status, string> = {
  safe: "fill-status-safe",
  warning: "fill-status-warning",
  danger: "fill-status-danger",
  not_started: "fill-none",
};

type AttendanceScaleProps = {
  code: string;
  percent: number | null;
  status: Status;
  className?: string;
};

export function AttendanceScale({
  code,
  percent,
  status,
  className = "",
}: AttendanceScaleProps) {
  const shouldReduceMotion = useReducedMotion();
  const clamped =
    percent === null ? 0 : Math.min(100, Math.max(0, percent));

  return (
    <div className={className}>
      <svg
        className="block h-3 w-full"
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        role="progressbar"
        aria-valuenow={percent ?? undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Attendance progress for ${code}. Exam limit ${HARD_LIMIT}%, safe cushion ${SAFE_LIMIT}%.`}
      >
        <rect x={0} y={1} width={100} height={4} className="fill-muted" />
        {percent !== null && (
          <motion.rect
            x={0}
            y={1}
            height={4}
            className={FILL_BY_STATUS[status]}
            initial={{ width: shouldReduceMotion ? clamped : 0 }}
            animate={{ width: clamped }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.65,
              ease: "easeOut" as const,
              delay: shouldReduceMotion ? 0 : 0.12,
            }}
          />
        )}
        <rect
          x={HARD_LIMIT - 0.4}
          y={0}
          width={0.8}
          height={6}
          className="fill-foreground/60"
        />
        <rect
          x={SAFE_LIMIT - 0.4}
          y={0}
          width={0.8}
          height={6}
          className="fill-status-safe"
        />
      </svg>
      <div className="relative mt-1 h-4 select-none leading-none">
        <span className="absolute left-0 text-[10px] text-muted-foreground">
          0%
        </span>
        <span className="absolute right-0 text-[10px] text-muted-foreground">
          100%
        </span>
        <span
          className="font-pixel absolute text-sm text-muted-foreground"
          style={{ left: `${HARD_LIMIT}%`, transform: "translateX(calc(-100% - 3px))" }}
        >
          {HARD_LIMIT}
        </span>
        <span
          className="font-pixel absolute text-sm text-status-safe"
          style={{ left: `calc(${SAFE_LIMIT}% + 3px)` }}
        >
          {SAFE_LIMIT}
        </span>
      </div>
    </div>
  );
}
