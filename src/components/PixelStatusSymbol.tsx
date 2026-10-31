import type { Status } from "@/lib/attendance";

const PATTERNS: Record<Status, readonly string[]> = {
  safe: [
    ".......",
    ".......",
    "......X",
    ".X...X.",
    "..X.X..",
    "...X...",
    ".......",
  ],
  warning: [
    "...X...",
    "...X...",
    "...X...",
    "...X...",
    "...X...",
    ".......",
    "...X...",
  ],
  danger: [
    "X.....X",
    ".X...X.",
    "..X.X..",
    "...X...",
    "..X.X..",
    ".X...X.",
    "X.....X",
  ],
  not_started: [
    ".......",
    ".......",
    ".......",
    ".XXXXX.",
    ".......",
    ".......",
    ".......",
  ],
};

type PixelStatusSymbolProps = {
  status: Status;
  className?: string;
};

export function PixelStatusSymbol({ status, className }: PixelStatusSymbolProps) {
  const cells: Array<{ x: number; y: number }> = [];
  PATTERNS[status].forEach((row, y) => {
    row.split("").forEach((ch, x) => {
      if (ch === "X") cells.push({ x, y });
    });
  });
  return (
    <svg
      viewBox="0 0 7 7"
      className={className}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} />
      ))}
    </svg>
  );
}
