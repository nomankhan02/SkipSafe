// Run with:  npx tsx src/lib/attendance.test.ts
import assert from "node:assert/strict";
import { Course, Status, analyzeCourse, analyzeAll } from "./attendance";

// Test data copied from the 12-OCT-26 report (fake student, real numbers).
const th = (code: string, credits: number, present: number, held: number): Course => ({
  code, thCredits: credits, prCredits: 0, thPresent: present, thHeld: held, prPresent: 0, prHeld: 0,
});

const ct159: Course = {
  code: "CT-159", thCredits: 3, prCredits: 1,
  thPresent: 18, thHeld: 23, prPresent: 18, prHeld: 18,
};

const report: Course[] = [
  ct159,
  th("CT-268", 2, 12, 16),
  th("EA-244", 3, 19, 20),
  th("EF-201", 2, 0, 0),
  th("MT-221", 3, 22, 24),
  th("MT-331", 3, 20, 24),
];

// code -> [percent printed by portal, hardSkips (75%), status]
const expected: Record<string, [number | null, number, Status]> = {
  "CT-159": [83.7, 10, "safe"],
  "CT-268": [75, 3, "safe"],
  "EA-244": [95, 10, "safe"],
  "EF-201": [null, 7, "not_started"],
  "MT-221": [91.67, 9, "safe"],
  "MT-331": [83.33, 7, "safe"],
};

for (const r of analyzeAll(report)) {
  const [pctWant, hardWant, statusWant] = expected[r.code];
  assert.equal(r.currentPercent, pctWant, `${r.code} percent`);
  assert.equal(r.hardSkips, hardWant, `${r.code} hard skips`);
  assert.equal(r.status, statusWant, `${r.code} status`);
  console.log(`ok  ${r.code}  ${String(r.currentPercent).padStart(5)}%  hard:${r.hardSkips}  ${r.status}`);
}

// EF-201 hasn't started
assert.equal(analyzeCourse(report[3]).status, "not_started");

// Edge: already below 75% -> danger, 0 skips
const bad = analyzeCourse(th("XX-100", 3, 30, 48));
assert.equal(bad.status, "danger");
assert.equal(bad.hardSkips, 0);

// Edge: exactly on the limit (45/60 = 75%, 4 credits x 15 weeks = 60 planned)
// -> 0 skips left, not negative, current at limit with 0 skips left -> warning
const edge = analyzeCourse(th("XX-101", 4, 45, 60));
assert.equal(edge.hardSkips, 0);
assert.equal(edge.status, "warning");

// Edge: hardSkips of exactly 2 (warning threshold boundary)
// 2 credits x 15 weeks = 30 planned; 15/20 held = 75%; missed = 5; max allowed missed = 7 -> hardSkips = 2 -> warning
const edge2 = analyzeCourse(th("XX-102", 2, 15, 20));
assert.equal(edge2.hardSkips, 2);
assert.equal(edge2.status, "warning");

// Edge: hardSkips of exactly 3 (safe threshold boundary)
// 2 credits x 15 weeks = 30 planned; 12/16 held = 75%; missed = 4; max allowed missed = 7 -> hardSkips = 3 -> safe
const edge3 = analyzeCourse(th("XX-103", 2, 12, 16));
assert.equal(edge3.hardSkips, 3);
assert.equal(edge3.status, "safe");

console.log("\nAll tests passed.");
