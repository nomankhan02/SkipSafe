import assert from "node:assert/strict";
import { Course, analyzeCourse, currentPercent } from "./attendance";
import {
  getCourseCardDisplay,
  sortCoursesByRisk,
} from "./courseCardDisplay";

// ─────────────────────────────────────────────────────────────────────────────
// 1. CT-159 recoverable danger case
// ─────────────────────────────────────────────────────────────────────────────
{
  const ct159Recoverable: Course = {
    code: "CT-159",
    thCredits: 3,
    prCredits: 1,
    thPresent: 19,
    thHeld: 26,
    prPresent: 13,
    prHeld: 17,
  };

  const cur = currentPercent(ct159Recoverable);
  assert.equal(cur, 73.93, "CT-159 current attendance should be 73.93%");

  const analysis = analyzeCourse(ct159Recoverable);
  assert.equal(analysis.status, "danger", "CT-159 status should be danger (<75%)");
  assert.equal(analysis.hardSkips, 4, "CT-159 hardSkips should be 4");

  const display = getCourseCardDisplay(ct159Recoverable, analysis);
  assert.equal(display.kind, "danger_recoverable");
  assert.equal(
    display.message,
    "Attend every remaining class to recover. You can miss at most 4 more."
  );
  assert.equal(display.skipsRemaining, 4);

  console.log("ok  CT-159 (73.93%, recoverable danger) shows recovery message with N=4");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Safe course case
// ─────────────────────────────────────────────────────────────────────────────
{
  const safeCourse: Course = {
    code: "CT-268",
    thCredits: 2,
    prCredits: 0,
    thPresent: 12,
    thHeld: 16,
    prPresent: 0,
    prHeld: 0,
  };

  const cur = currentPercent(safeCourse);
  assert.equal(cur, 75, "CT-268 current attendance should be 75%");

  const analysis = analyzeCourse(safeCourse);
  assert.equal(analysis.status, "safe", "CT-268 status should be safe (3 skips left > 2)");
  assert.equal(analysis.hardSkips, 3, "CT-268 hardSkips should be 3");

  const display = getCourseCardDisplay(safeCourse, analysis);
  assert.equal(display.kind, "normal");
  assert.equal(display.displayValue, "3");
  assert.equal(display.skipsRemaining, 3);

  console.log("ok  Safe course (CT-268) shows normal skips-left figure (3)");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Unrecoverable danger case
// ─────────────────────────────────────────────────────────────────────────────
{
  const unrecoverableCourse: Course = {
    code: "XX-100",
    thCredits: 3,
    prCredits: 0,
    thPresent: 30,
    thHeld: 48,
    prPresent: 0,
    prHeld: 0,
  };

  const analysis = analyzeCourse(unrecoverableCourse);
  assert.equal(analysis.status, "danger");

  const display = getCourseCardDisplay(unrecoverableCourse, analysis);
  assert.equal(display.kind, "danger_unrecoverable");
  assert.equal(
    display.message,
    "Cannot reach 75% even if you attend every remaining class."
  );
  assert.equal(display.skipsRemaining, null, "unrecoverable course must not show skip count");

  console.log("ok  Unrecoverable course shows cannot reach 75% message without skip count");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Sort order by risk: danger, warning, safe, not_started
// ─────────────────────────────────────────────────────────────────────────────
{
  const courses: Course[] = [
    { code: "NOT-STARTED", thCredits: 2, prCredits: 0, thPresent: 0, thHeld: 0, prPresent: 0, prHeld: 0 },
    { code: "SAFE", thCredits: 3, prCredits: 0, thPresent: 19, thHeld: 20, prPresent: 0, prHeld: 0 },
    { code: "DANGER", thCredits: 3, prCredits: 0, thPresent: 30, thHeld: 48, prPresent: 0, prHeld: 0 },
    { code: "WARNING", thCredits: 4, prCredits: 0, thPresent: 45, thHeld: 60, prPresent: 0, prHeld: 0 },
  ];

  const analyzed = courses.map((course) => ({
    course,
    analysis: analyzeCourse(course),
  }));

  const sorted = sortCoursesByRisk(analyzed);
  const sortedStatuses = sorted.map((s) => s.analysis.status);

  assert.deepEqual(sortedStatuses, ["danger", "warning", "safe", "not_started"]);
  console.log("ok  Courses sorted by risk order: danger, warning, safe, not_started");
}

console.log("\nAll courseCardDisplay tests passed.");

