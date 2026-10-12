// attendance.ts — pure logic, no UI, no network. Safe to test on its own.

export const WEEKS_PER_SEMESTER = 16;
export const HARD_LIMIT = 75; // real exam-eligibility rule (per course)
export const SAFE_LIMIT = 80; // our cushion, shown as "stay above 80%"

export type Course = {
  code: string;
  thCredits: number; // e.g. 3 for "3 Th + 1 Pr"
  prCredits: number; // e.g. 1 for "3 Th + 1 Pr", 0 if none
  thPresent: number;
  thHeld: number;
  prPresent: number;
  prHeld: number;
  // Optional overrides. If missing: theory = credits * 16 weeks,
  // practical = what's been held so far (student can edit this).
  thPlanned?: number;
  prPlanned?: number;
};

export type Status = "not_started" | "safe" | "warning" | "danger";

export type CourseResult = {
  code: string;
  currentPercent: number | null; // matches the portal's number; null if not started
  status: Status;
  safeSkips: number; // skips left while still finishing >= 80%
  hardSkips: number; // skips left while still finishing >= 75%
};

const pct = (present: number, held: number) => (held === 0 ? 0 : (present / held) * 100);

/** Percentage as the portal prints it (credit-weighted theory + practical). */
export function currentPercent(c: Course): number | null {
  if (c.thHeld === 0 && c.prHeld === 0) return null;
  const th = pct(c.thPresent, c.thHeld);
  if (c.prCredits === 0) return round2(th);
  const pr = pct(c.prPresent, c.prHeld);
  return round2((c.thCredits * th + c.prCredits * pr) / (c.thCredits + c.prCredits));
}

/**
 * Projected FINAL percentage if the student misses `extraTheorySkips`
 * more theory classes and attends everything else.
 */
function projectedFinal(c: Course, extraTheorySkips: number): number {
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

/** How many more theory classes can be skipped and still finish >= minPercent. */
export function skipsLeft(c: Course, minPercent: number): number {
  const thPlanned = c.thPlanned ?? c.thCredits * WEEKS_PER_SEMESTER;
  let s = -1;
  // small epsilon so e.g. exactly 75.0 counts as OK despite float rounding
  while (s < thPlanned && projectedFinal(c, s + 1) >= minPercent - 1e-9) s++;
  return Math.max(s, 0);
}

export function analyzeCourse(c: Course): CourseResult {
  const cur = currentPercent(c);
  const hardSkips = skipsLeft(c, HARD_LIMIT);
  const safeSkips = skipsLeft(c, SAFE_LIMIT);

  let status: Status;
  if (cur === null) status = "not_started";
  else if (cur < HARD_LIMIT || projectedFinal(c, 0) < HARD_LIMIT) status = "danger";
  else if (cur < SAFE_LIMIT || safeSkips === 0) status = "warning";
  else status = "safe";

  return { code: c.code, currentPercent: cur, status, safeSkips, hardSkips };
}

export function analyzeAll(courses: Course[]): CourseResult[] {
  return courses.map(analyzeCourse);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
