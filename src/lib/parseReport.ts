/**
 * parseReport.ts — PDF parser for the NED "Course-Wise Attendance Analysis" report.
 *
 * Why position-based parsing?
 * pdfjs text extraction in plain string order loses the row structure because the
 * PDF renderer emits items column-by-column, not row-by-row. We read every text
 * item with its (x, y) position and cluster items into table rows by rounding y to
 * the nearest 4 points, then match each x to the column by proximity.
 *
 * PRIVACY: This function never logs or stores the PDF binary or its text content.
 * All data lives only in the returned Course[] array.
 */

import type { Course } from "./attendance";

// ─── Column x-coordinate thresholds (centre of each column, ±30 pt tolerance) ───
// Determined empirically from sample-attendance.pdf probe output.
const COL = {
  sno:       { min:  35, max:  80 },   // "S.No."
  code:      { min:  95, max: 165 },   // "Course Code"
  credits:   { min: 185, max: 265 },   // "Credit Hrs"  (e.g. "3 Th + 1 Pr")
  thPresent: { min: 266, max: 310 },   // Theory Present
  thHeld:    { min: 311, max: 355 },   // Theory Held
  prPresent: { min: 356, max: 400 },   // Practical Present (or "-")
  prHeld:    { min: 401, max: 445 },   // Practical Held    (or "-")
  pct:       { min: 480, max: 535 },   // Printed percentage
} as const;

type ColName = keyof typeof COL;

/** Round y to the nearest 4pt bucket so nearby items land in the same row. */
const rowKey = (y: number) => Math.round(y / 4) * 4;

interface RawRow {
  y: number;
  cells: Partial<Record<ColName, string>>;
}

/** Return which column name an x coordinate belongs to, or null. */
function classifyX(x: number): ColName | null {
  for (const [name, range] of Object.entries(COL)) {
    if (x >= range.min && x <= range.max) return name as ColName;
  }
  return null;
}

/** Parse "3 Th + 1 Pr" -> { th: 3, pr: 1 }. Also handles "2 Th + 0 Pr". */
function parseCredits(raw: string): { th: number; pr: number } {
  const m = raw.match(/^(\d+)\s*Th\s*\+\s*(\d+)\s*Pr$/i);
  if (!m) throw new Error(`Unrecognised credit-hours format: "${raw}"`);
  return { th: parseInt(m[1], 10), pr: parseInt(m[2], 10) };
}

/** Parse a present/held cell: "-" -> 0, otherwise parseInt. */
function parseCount(raw: string): number {
  const s = raw.trim();
  if (s === "-") return 0;
  const n = parseInt(s, 10);
  if (isNaN(n)) throw new Error(`Expected a number or "-", got: "${s}"`);
  return n;
}

/** Credit-weighted percentage, matching the portal formula in attendance.ts. */
function computePct(
  thPresent: number, thHeld: number, thCredits: number,
  prPresent: number, prHeld: number, prCredits: number,
): number | null {
  if (thHeld === 0 && prHeld === 0) return null;
  const thPct = thHeld === 0 ? 0 : (thPresent / thHeld) * 100;
  if (prCredits === 0) return Math.round(thPct * 100) / 100;
  const prPct = prHeld === 0 ? 0 : (prPresent / prHeld) * 100;
  return Math.round(((thCredits * thPct + prCredits * prPct) / (thCredits + prCredits)) * 100) / 100;
}

export interface ParseWarning {
  code: string;
  computed: number | null;
  printed: number;
  delta: number;
}

export interface ParseResult {
  courses: Course[];
  /** Non-empty when a printed percentage does not match our computation. */
  warnings: ParseWarning[];
}

/**
 * Parse a NED Course-Wise Attendance Analysis PDF.
 *
 * @param pdfData  Raw PDF bytes (ArrayBuffer or Uint8Array). Never logged.
 * @returns        Parsed courses plus any sanity-check warnings.
 * @throws         When the PDF does not look like the expected report layout.
 */
export async function parseAttendanceReport(
  pdfData: ArrayBuffer | Uint8Array,
): Promise<ParseResult> {
  // Dynamic import keeps pdfjs out of the browser bundle unless this function
  // is actually called, and avoids a hard top-level worker setup.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // In Node (tests), resolve the worker path relative to project root.
  // In the browser, the caller should set workerSrc before calling this function.
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    try {
      const { fileURLToPath } = await import("url");
      const { resolve, dirname } = await import("path");
      const here = dirname(fileURLToPath(import.meta.url));
      const workerPath = resolve(
        here,
        "../../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      );
      pdfjs.GlobalWorkerOptions.workerSrc = "file://" + workerPath.replace(/\\/g, "/");
    } catch {
      // Browser: caller is responsible for setting workerSrc.
    }
  }

  const data = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
  const doc = await pdfjs.getDocument({ data }).promise;

  // Collect ALL text items across all pages into a y-keyed map.
  const rowMap = new Map<number, RawRow>();
  let foundHeader = false;

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const text = item.str.trim();
      if (!text) continue;

      const x = (item.transform as number[])[4];
      const y = (item.transform as number[])[5];

      // Detect the header row to confirm this is the right report.
      if (text === "Course Code") foundHeader = true;

      const col = classifyX(x);
      if (!col) continue; // outside all known columns, ignore

      const key = rowKey(y);
      if (!rowMap.has(key)) rowMap.set(key, { y, cells: {} });
      const row = rowMap.get(key)!;
      // If two items land in the same cell, concatenate with a space.
      row.cells[col] = row.cells[col] ? row.cells[col] + " " + text : text;
    }
  }

  if (!foundHeader) {
    throw new Error(
      'PDF layout not recognised: could not find "Course Code" column header. ' +
      "Make sure you are uploading a NED Course-Wise Attendance Analysis report.",
    );
  }

  // Sort rows top-to-bottom (highest y = top in PDF coordinates).
  const sortedRows = [...rowMap.values()].sort((a, b) => b.y - a.y);

  const courses: Course[] = [];
  const warnings: ParseWarning[] = [];

  for (const row of sortedRows) {
    const { cells } = row;

    // A data row must have at least: code, credits, thPresent, thHeld.
    if (
      !cells.code ||
      !cells.credits ||
      cells.thPresent === undefined ||
      cells.thHeld === undefined
    ) {
      continue;
    }

    // Try to parse credits — skip if it looks like a header label.
    let credParsed: { th: number; pr: number };
    try {
      credParsed = parseCredits(cells.credits);
    } catch {
      continue; // e.g. the literal "Credit Hrs" header cell — skip
    }

    const thPresent = parseCount(cells.thPresent);
    const thHeld    = parseCount(cells.thHeld ?? "0");
    const prPresent = parseCount(cells.prPresent ?? "-");
    const prHeld    = parseCount(cells.prHeld    ?? "-");

    const course: Course = {
      code:      cells.code,
      thCredits: credParsed.th,
      prCredits: credParsed.pr,
      thPresent,
      thHeld,
      prPresent,
      prHeld,
    };

    // ── Sanity check: compare our computed percentage with the printed one ──
    if (cells.pct !== undefined) {
      const printed  = parseFloat(cells.pct);
      const computed = computePct(thPresent, thHeld, credParsed.th, prPresent, prHeld, credParsed.pr);
      if (!isNaN(printed) && computed !== null) {
        const delta = Math.abs((computed ?? 0) - printed);
        if (delta > 0.1) {
          // More than 0.1 percentage point off -> flag it.
          warnings.push({ code: cells.code, computed, printed, delta });
        }
      }
      // If printed is "0" and both held=0, computed is null -> no warning (EF-201 case).
    }

    courses.push(course);
  }

  if (courses.length === 0) {
    throw new Error(
      "PDF layout not recognised: header was found but no course rows could be parsed. " +
      "The report may be empty or in an unexpected format.",
    );
  }

  return { courses, warnings };
}
