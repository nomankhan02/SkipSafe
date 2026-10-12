// Run with:  npx tsx src/lib/attendance.test.ts
import assert from "node:assert/strict";
import { Course, analyzeCourse, analyzeAll } from "./attendance";

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

// code -> [percent printed by portal, safeSkips (80%), hardSkips (75%)]
const expected: Record<string, [number | null, number, number]> = {
  "CT-159": [83.7, 7, 11],
  "CT-268": [75, 2, 4],
  "EA-244": [95, 8, 11],
  "EF-201": [null, 6, 8],
  "MT-221": [91.67, 7, 10],
  "MT-331": [83.33, 5, 8],
};

for (const r of analyzeAll(report)) {
  const [pctWant, safeWant, hardWant] = expected[r.code];
  assert.equal(r.currentPercent, pctWant, `${r.code} percent`);
  assert.equal(r.safeSkips, safeWant, `${r.code} safe skips`);
  assert.equal(r.hardSkips, hardWant, `${r.code} hard skips`);
  console.log(`ok  ${r.code}  ${String(r.currentPercent).padStart(5)}%  safe:${r.safeSkips}  hard:${r.hardSkips}  ${r.status}`);
}

// EF-201 hasn't started
assert.equal(analyzeCourse(report[3]).status, "not_started");

// Edge: already below 75% -> danger, 0 skips
const bad = analyzeCourse(th("XX-100", 3, 30, 48));
assert.equal(bad.status, "danger");
assert.equal(bad.hardSkips, 0);

// Edge: exactly on the limit (36/48 = 75%) -> 0 skips left, not negative
const edge = analyzeCourse(th("XX-101", 3, 36, 48));
assert.equal(edge.hardSkips, 0);

console.log("\nAll tests passed.");
