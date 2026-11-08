import type { Status } from "@/lib/attendance";

export type StatusSymbolState =
  | "safe"
  | "limit_reached"
  | "danger"
  | "not_started";

export function getStatusSymbolState(
  status: Status,
  hardSkips: number
): StatusSymbolState {
  if (status === "not_started") return "not_started";
  if (status === "danger") return "danger";
  if (hardSkips === 0) return "limit_reached";
  return "safe";
}

type StatusSymbolProps = {
  status?: Status;
  state?: StatusSymbolState;
  hardSkips?: number;
  className?: string;
};

/**
 * EditorialStatusSymbol — Swiss editorial geometric status marks.
 * Clean, hairline 1.25px - 1.5px vector strokes on a 16x16 coordinate frame.
 * Restrained geometry:
 * - safe: crisp clean polyline checkmark (attendance safe with skips remaining)
 * - limit_reached: equilateral warning diamond (0 skips left while still at limit)
 * - danger: precise thin 45-degree diagonal cross (below 75% or recovery risk)
 * - not_started: crisp centered horizontal dashed rule (no classes recorded yet)
 */
export function StatusSymbol({
  status,
  state,
  hardSkips = 0,
  className = "size-3.5",
}: StatusSymbolProps) {
  const resolvedState: StatusSymbolState =
    state ??
    (status
      ? getStatusSymbolState(status, hardSkips)
      : "not_started");

  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {resolvedState === "safe" && (
        <polyline points="3.5 8.5 6.5 11.5 12.5 5" />
      )}

      {resolvedState === "limit_reached" && (
        <polygon points="8 2.5 13.5 8 8 13.5 2.5 8" />
      )}

      {resolvedState === "danger" && (
        <>
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </>
      )}

      {resolvedState === "not_started" && (
        <line x1="4" y1="8" x2="12" y2="8" strokeDasharray="1.5 1.5" />
      )}
    </svg>
  );
}

export const PixelStatusSymbol = StatusSymbol;
