import {
  type Course,
  type CourseResult,
  type Status,
  HARD_LIMIT,
  WEEKS_PER_SEMESTER,
} from "./attendance";

export const RISK_ORDER: Record<Status, number> = {
  danger: 0,
  warning: 1,
  safe: 2,
  not_started: 3,
};

/**
 * Projected final percentage if the student attends all remaining classes
 * (0 extra theory skips).
 */
export function projectedFinalPercent(c: Course, extraTheorySkips = 0): number {
  const thPlanned = c.thPlanned ?? c.thCredits * WEEKS_PER_SEMESTER;
  const thMissed = c.thHeld - c.thPresent + extraTheorySkips;
  const th = ((thPlanned - thMissed) / thPlanned) * 100;
  if (c.prCredits === 0) return th;

  const prPlanned = c.prPlanned ?? c.prHeld;
  if (prPlanned === 0) return th;
  const prMissed = c.prHeld - c.prPresent;
  const pr = ((prPlanned - prMissed) / prPlanned) * 100;
  return (c.thCredits * th + c.prCredits * pr) / (c.thCredits + c.prCredits);
}

/**
 * Returns true if the course can reach HARD_LIMIT (75%) by attending
 * all remaining planned classes.
 */
export function canReachHardLimit(c: Course): boolean {
  return projectedFinalPercent(c, 0) >= HARD_LIMIT - 1e-9;
}

export type CourseCardDisplay =
  | {
      kind: "danger_recoverable";
      message: string;
      skipsRemaining: number;
    }
  | {
      kind: "danger_unrecoverable";
      message: string;
      skipsRemaining: null;
    }
  | {
      kind: "normal";
      skipsRemaining: number | null;
      displayValue: string;
    };

/**
 * Determines card readout for a course:
 * - Danger & recoverable: "Attend every remaining class to recover. You can miss at most N more."
 * - Danger & unrecoverable: "Cannot reach 75% even if you attend every remaining class." (no skip count)
 * - Safe / Warning / Not started: normal skips-left figure
 */
export function getCourseCardDisplay(
  course: Course,
  analysis: CourseResult
): CourseCardDisplay {
  if (analysis.status === "danger") {
    if (canReachHardLimit(course)) {
      return {
        kind: "danger_recoverable",
        message: `Attend every remaining class to recover. You can miss at most ${analysis.hardSkips} more.`,
        skipsRemaining: analysis.hardSkips,
      };
    }
    return {
      kind: "danger_unrecoverable",
      message: "Cannot reach 75% even if you attend every remaining class.",
      skipsRemaining: null,
    };
  }

  return {
    kind: "normal",
    skipsRemaining:
      analysis.currentPercent !== null ? analysis.hardSkips : null,
    displayValue:
      analysis.currentPercent !== null ? `${analysis.hardSkips}` : "—",
  };
}

/**
 * Sorts analyzed courses by risk: danger, warning, safe, not_started.
 */
export function sortCoursesByRisk<T extends { analysis: CourseResult }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => RISK_ORDER[a.analysis.status] - RISK_ORDER[b.analysis.status]
  );
}

