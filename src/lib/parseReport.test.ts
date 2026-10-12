/**
 * parseReport.test.ts — Integration test for the NED attendance PDF parser.
 *
 * Run with:  npx tsx src/lib/parseReport.test.ts
 *
 * What this file does, section by section:
 *
 *  1. LOAD  — reads test-data/sample-attendance.pdf into a Uint8Array and passes
 *             it to parseAttendanceReport().  No file path or bytes are ever
 *             printed; the buffer lives only in memory for the duration of the test.
 *
 *  2. COUNT — asserts that exactly 6 Course objects were returned, matching the 6
 *             rows visible in the sample report (CT-159 … MT-331).
 *
 *  3. LOOKUP helper — looks each course up by code so the assertions below are
 *             independent of iteration order.
 *
 *  4. CT-159 (mixed Theory + Practical)
 *             - credit hours "3 Th + 1 Pr" must become thCredits=3, prCredits=1
 *             - theory:     18 present / 23 held
 *             - practical:  18 present / 18 held
 *             This is the only course that exercises the Practical columns.
 *
 *  5. CT-268, EA-244, MT-221, MT-331 (theory-only courses)
 *             prCredits must be 0, prPresent/prHeld must be 0 because the PDF
 *             prints "-" in those cells.
 *
 *  6. EF-201 (not yet started)
 *             thHeld=0, prHeld=0 — the parser must return zeroes, not throw.
 *
 *  7. WARNINGS — parseAttendanceReport() computes our own credit-weighted
 *             percentage and compares it to the printed value.  The sample PDF
 *             has consistent numbers, so no warnings are expected.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseAttendanceReport } from "./parseReport.js";
import type { Course } from "./attendance.js";

async function main() {
  // ── 1. LOAD ────────────────────────────────────────────────────────────────
  // Read the raw bytes from disk; the buffer is never printed or persisted.
  const pdfBytes = readFileSync("test-data/sample-attendance.pdf");
  const { courses, warnings } = await parseAttendanceReport(new Uint8Array(pdfBytes));

  // ── 2. COUNT ───────────────────────────────────────────────────────────────
  // The sample report has exactly 6 course rows.
  assert.equal(courses.length, 6, `Expected 6 courses, got ${courses.length}`);
  console.log(`ok  course count = ${courses.length}`);

  // ── 3. LOOKUP helper ───────────────────────────────────────────────────────
  // Finds a course by code so assertions below are order-independent.
  function get(code: string): Course {
    const c = courses.find((x) => x.code === code);
    if (!c) throw new Error(`Course ${code} not found in parse result`);
    return c;
  }

  // ── 4. CT-159 — mixed Theory + Practical ───────────────────────────────────
  // "3 Th + 1 Pr" → thCredits=3, prCredits=1.
  // Practical columns contain real numbers (not "-"), so prPresent/prHeld are non-zero.
  {
    const c = get("CT-159");
    assert.equal(c.thCredits,  3,  "CT-159 thCredits");
    assert.equal(c.prCredits,  1,  "CT-159 prCredits");
    assert.equal(c.thPresent, 18,  "CT-159 thPresent");
    assert.equal(c.thHeld,    23,  "CT-159 thHeld");
    assert.equal(c.prPresent, 18,  "CT-159 prPresent");
    assert.equal(c.prHeld,    18,  "CT-159 prHeld");
    console.log("ok  CT-159  3 Th + 1 Pr  18/23 theory  18/18 practical");
  }

  // ── 5a. CT-268 — theory-only ────────────────────────────────────────────────
  // "2 Th + 0 Pr": practical columns print "-"; parser must treat "-" as 0.
  {
    const c = get("CT-268");
    assert.equal(c.thCredits,  2,  "CT-268 thCredits");
    assert.equal(c.prCredits,  0,  "CT-268 prCredits");
    assert.equal(c.thPresent, 12,  "CT-268 thPresent");
    assert.equal(c.thHeld,    16,  "CT-268 thHeld");
    assert.equal(c.prPresent,  0,  "CT-268 prPresent (dash -> 0)");
    assert.equal(c.prHeld,     0,  "CT-268 prHeld (dash -> 0)");
    console.log("ok  CT-268  12/16 theory  practical = 0/0 (-)");
  }

  // ── 5b. EA-244 ─────────────────────────────────────────────────────────────
  {
    const c = get("EA-244");
    assert.equal(c.thPresent, 19, "EA-244 thPresent");
    assert.equal(c.thHeld,    20, "EA-244 thHeld");
    assert.equal(c.prPresent,  0, "EA-244 prPresent");
    assert.equal(c.prHeld,     0, "EA-244 prHeld");
    console.log("ok  EA-244  19/20 theory");
  }

  // ── 6. EF-201 — not yet started ─────────────────────────────────────────────
  // thHeld=0 and prHeld=0 — parser must not throw; return zeroes.
  {
    const c = get("EF-201");
    assert.equal(c.thPresent, 0, "EF-201 thPresent");
    assert.equal(c.thHeld,    0, "EF-201 thHeld");
    assert.equal(c.prPresent, 0, "EF-201 prPresent");
    assert.equal(c.prHeld,    0, "EF-201 prHeld");
    console.log("ok  EF-201  0/0 (not started)");
  }

  // ── 5c. MT-221 ─────────────────────────────────────────────────────────────
  {
    const c = get("MT-221");
    assert.equal(c.thPresent, 22, "MT-221 thPresent");
    assert.equal(c.thHeld,    24, "MT-221 thHeld");
    console.log("ok  MT-221  22/24 theory");
  }

  // ── 5d. MT-331 ─────────────────────────────────────────────────────────────
  {
    const c = get("MT-331");
    assert.equal(c.thPresent, 20, "MT-331 thPresent");
    assert.equal(c.thHeld,    24, "MT-331 thHeld");
    console.log("ok  MT-331  20/24 theory");
  }

  // ── 7. WARNINGS ────────────────────────────────────────────────────────────
  // The parser computes our own credit-weighted percentage and compares it to
  // the value printed on the report.  The sample PDF has consistent numbers, so
  // no mismatches (delta > 0.1 pp) are expected.
  assert.equal(
    warnings.length,
    0,
    `Unexpected percentage mismatches: ${JSON.stringify(warnings)}`,
  );
  console.log("ok  no percentage mismatches");

  console.log("\nAll parseReport tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
