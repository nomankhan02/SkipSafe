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

// ─── Default column x-coordinate thresholds (centre of each column, ±30 pt tolerance) ───
// Determined empirically from sample-attendance.pdf probe output.
// Used as fallback when dynamic column detection is not possible or ambiguous.
// A fallback is only acceptable when its result can be validated.
const DEFAULT_COL = {
  sno:       { min:  35, max:  80 },   // "S.No."
  code:      { min:  95, max: 165 },   // "Course Code"
  credits:   { min: 185, max: 265 },   // "Credit Hrs"  (e.g. "3 Th + 1 Pr")
  thPresent: { min: 266, max: 310 },   // Theory Present
  thHeld:    { min: 311, max: 355 },   // Theory Held
  prPresent: { min: 356, max: 400 },   // Practical Present (or "-")
  prHeld:    { min: 401, max: 445 },   // Practical Held    (or "-")
  pct:       { min: 480, max: 535 },   // Printed percentage
} as const;

type ColName = keyof typeof DEFAULT_COL;

// Accepted header tokens for column detection. Matching is case-insensitive.
// At least one code-family token is required to confirm a header row.
const HEADER_TOKENS: Record<string, string[]> = {
  code:      ["course code", "course", "subject code", "code"],
  credits:   ["credit hrs", "credits", "credit hours", "credit"],
  thPresent: ["theory present", "th present", "present"],
  thHeld:    ["theory held", "th held", "held"],
  prPresent: ["practical present", "pr present", "lab present"],
  prHeld:    ["practical held", "pr held", "lab held"],
  pct:       ["%", "percentage", "attendance %", "attendance"],
} as const;

/** Round y to the nearest 4pt bucket so nearby items land in the same row. */
const rowKey = (y: number) => Math.round(y / 4) * 4;

interface RawRow {
  y: number;
  page: number;
  cells: Partial<Record<ColName, string>>;
}

interface ColumnAnchor {
  name: ColName;
  x: number;
}

/** Result of counting a present/held cell. */
interface ParsedCount {
  value: number;
  source: "explicit" | "defaulted" | "missing";
}

/** Why a row was not turned into a course. */
export type SkippedRowClassification = "metadata" | "incomplete";

/** Fine-grained metadata category, used for diagnostics and UI copy. */
export type MetadataKind =
  | "table_header"
  | "page_header"
  | "student_information"
  | "academic_year"
  | "date"
  | "department"
  | "footer"
  | "page_furniture";

/**
 * A row that was not turned into a course.
 *
 * Metadata rows are reported too, rather than silently discarded, but they are
 * clearly classified so callers can avoid presenting them as course errors.
 */
export interface SkippedRow {
  code: string | null;
  reason: string;
  rowY: number;
  page: number;
  classification: SkippedRowClassification;
  metadataKind?: MetadataKind;
}

interface MetadataMatch {
  kind: MetadataKind;
  reason: string;
}

/** Minimal row shape accepted by the exported classifier (useful for tests). */
export interface RowCellsInput {
  code?: string;
  credits?: string;
  thPresent?: string;
  thHeld?: string;
  prPresent?: string;
  prHeld?: string;
  pct?: string;
}

export interface RowInput {
  y: number;
  page: number;
  cells: RowCellsInput;
}

export type RowClassificationResult =
  | {
      classification: "metadata";
      code: string | null;
      reason: string;
      metadataKind: MetadataKind;
    }
  | {
      classification: "incomplete";
      code: string | null;
      reason: string;
    };

const STUDENT_INFO_PATTERN =
  /\b(student\s*name|name\s*of\s*student|roll\s*(?:no|number)|registration\s*(?:no|number)|enrol?lment\s*(?:no|number))\b/i;

const DATE_PATTERN =
  /\b(?:\d{1,2}[\/.\- ](?:jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\/.\- ]\d{2,4}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})\b/i;

const ACADEMIC_YEAR_PATTERN =
  /\b(?:19|20)\d{2}\s*[-–—/]\s*(?:(?:19|20)\d{2}|\d{2})\b/;

const DEPARTMENT_PATTERN =
  /\b(department\s+of|faculty\s+of|school\s+of|college\s+of|department|faculty|discipline)\b/i;

const FOOTER_PATTERN =
  /(©|\(c\)|copyright|all\s+rights\s+reserved|developed\s+by|powered\s+by|generated\s+by|printed\s+by|printed\s+on)/i;

const SUMMARY_PATTERN =
  /\b(average\s+aggregate\s+attendance|aggregate\s+attendance|grand\s+total|total\s+attendance)\b/i;

const NOTE_PATTERN = /^(?:note\s*:|notes?\b|\d+\.\s)/i;

const PAGE_FURNITURE_PATTERN = /^(?:page\s+)?\d+\s*(?:of|\/)\s*\d+$/i;

/**
 * High-confidence metadata detection.
 *
 * We deliberately avoid guessing from capitalization, word count, or a
 * university-specific course-code shape. The only structural assumption is
 * that rows above the detected table header are page furniture: a real course
 * row cannot precede the table header that defines the table.
 */
function classifyMetadataRow(
  row: RowInput,
  rowText: string,
  headerRowYByPage: ReadonlyMap<number, number>,
): MetadataMatch | null {
  const headerY = headerRowYByPage.get(row.page);

  // Content patterns are checked first so metadata gets a specific label.
  if (rowText) {
    if (FOOTER_PATTERN.test(rowText)) {
      return { kind: "footer", reason: "Copyright/footer text" };
    }

    if (STUDENT_INFO_PATTERN.test(rowText)) {
      return { kind: "student_information", reason: "Student information" };
    }

    if (ACADEMIC_YEAR_PATTERN.test(rowText)) {
      return { kind: "academic_year", reason: "Academic year" };
    }

    if (DATE_PATTERN.test(rowText)) {
      return { kind: "date", reason: "Report date" };
    }

    if (DEPARTMENT_PATTERN.test(rowText)) {
      return { kind: "department", reason: "Department/faculty heading" };
    }

    if (SUMMARY_PATTERN.test(rowText)) {
      return { kind: "page_furniture", reason: "Aggregate/summary row" };
    }

    if (NOTE_PATTERN.test(rowText)) {
      return { kind: "page_furniture", reason: "Report note" };
    }

    if (PAGE_FURNITURE_PATTERN.test(rowText)) {
      return { kind: "page_furniture", reason: "Page furniture" };
    }
  }

  // The table header row itself may contain labels that were not in
  // HEADER_TOKENS (for example "S.No." or "Attendance").
  if (headerY !== undefined && Math.abs(row.y - headerY) < 4) {
    return { kind: "table_header", reason: "Table header row" };
  }

  // Rows above the table header on any page are page-level metadata. A row
  // with a complete course shape is kept as a course candidate, so a
  // mis-bucketed real course is never dismissed as metadata.
  if (
    headerY !== undefined &&
    row.y > headerY + 4 &&
    !hasMinimumCourseFields(row)
  ) {
    return { kind: "page_header", reason: "Page header above the course table" };
  }

  return null;
}

function hasMinimumCourseFields(row: RowInput): boolean {
  const { cells } = row;
  const rawCode = cells.code;
  const hasCode =
    rawCode !== undefined &&
    rawCode !== "" &&
    !/^\d+$/.test(rawCode.trim());
  return (
    hasCode &&
    Boolean(cells.credits) &&
    cells.thPresent !== undefined &&
    cells.thHeld !== undefined
  );
}

/**
 * Pure row classification used by the parser.
 *
 * Returns `null` only when the row has the minimum fields needed to attempt a
 * course. Metadata and incomplete rows are always accounted for explicitly.
 */
export function classifyRow(
  row: RowInput,
  headerRowYByPage: ReadonlyMap<number, number>,
): RowClassificationResult | null {
  const { cells } = row;
  const rowText = Object.values(cells)
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim();

  const metadata = classifyMetadataRow(row, rowText, headerRowYByPage);
  if (metadata) {
    return {
      classification: "metadata",
      code: cells.code ?? null,
      reason: metadata.reason,
      metadataKind: metadata.kind,
    };
  }

  const rawCode = cells.code;
  const hasCode =
    rawCode !== undefined &&
    rawCode !== "" &&
    !/^\d+$/.test(rawCode.trim());
  const hasCredits = Boolean(cells.credits);

  if (!hasCode && !hasCredits) {
    return {
      classification: "incomplete",
      code: rawCode ?? null,
      reason: "No recognizable course code or credit-hours value",
    };
  }

  const missingRequired: string[] = [];
  if (!hasCode) missingRequired.push("code");
  if (!hasCredits) missingRequired.push("credits");
  if (cells.thPresent === undefined) missingRequired.push("thPresent");
  if (cells.thHeld === undefined) missingRequired.push("thHeld");

  if (missingRequired.length > 0) {
    return {
      classification: "incomplete",
      code: rawCode ?? null,
      reason: `Missing required fields: ${missingRequired.join(", ")}`,
    };
  }

  return null;
}

/** Return which column name an x coordinate belongs to, or null. */
function classifyX(
  x: number,
  colRanges: Record<ColName, { min: number; max: number }>,
): ColName | null {
  for (const [name, range] of Object.entries(colRanges)) {
    const colName = name as ColName;
    if (x >= range.min && x <= range.max) return colName;
  }
  return null;
}

/** Detect column anchors from header row text items. */
function detectColumnAnchors(
  headerRowItems: { text: string; x: number }[],
): ColumnAnchor[] | null {
  const anchors: ColumnAnchor[] = [];
  const usedX = new Set<number>();

  for (const item of headerRowItems) {
    const lower = item.text.toLowerCase();
    let matchedName: ColName | null = null;

    for (const [colName, tokens] of Object.entries(HEADER_TOKENS)) {
      if (tokens.some((t) => lower === t)) {
        matchedName = colName as ColName;
        break;
      }
    }

    if (!matchedName || usedX.has(item.x)) continue;

    anchors.push({ name: matchedName, x: item.x });
    usedX.add(item.x);
  }

  // Require at least the code column anchor to consider detection successful.
  if (!anchors.some((a) => a.name === "code")) return null;

  return anchors;
}

/**
 * Build column ranges from detected anchors, using DEFAULT_COL widths.
 * Detected anchor x becomes the centre; DEFAULT_COL half-width is preserved
 * so data items at slightly different x positions are not excluded.
 * Returns null if no code anchor was detected (detection failed).
 */
function buildColRangesFromAnchors(
  anchors: ColumnAnchor[],
): Record<ColName, { min: number; max: number }> | null {
  if (!anchors.some((a) => a.name === "code")) return null;

  const ranges: Record<ColName, { min: number; max: number }> = {} as Record<ColName, { min: number; max: number }>;
  for (const [name, defRange] of Object.entries(DEFAULT_COL)) {
    const colName = name as ColName;
    ranges[colName] = { ...defRange };
  }

  for (const anchor of anchors) {
    const defRange = DEFAULT_COL[anchor.name];
    const halfWidth = (defRange.max - defRange.min) / 2;
    ranges[anchor.name] = {
      min: anchor.x - halfWidth,
      max: anchor.x + halfWidth,
    };
  }

  return ranges;
}

/** Parse "3 Th + 1 Pr" -> { th: 3, pr: 1 }. Supports multiple credit formats. */
function parseCredits(raw: string): { th: number; pr: number } {
  const patterns: RegExp[] = [
    /^(\d+)\s*Th\s*\+\s*(\d+)\s*Pr$/i,        // "3 Th + 1 Pr"
    /^(\d+)\s*-\s*(\d+)$/i,                    // "3-1"
    /^(\d+)\s*T\s*\+\s*(\d+)\s*P$/i,           // "3T+1P"
    /^(\d+)\s*\+\s*(\d+)$/i,                   // "3+1"
    /^(\d+)\s*Th\s*(\d+)\s*Pr$/i,              // "3 Th 1 Pr"
  ];

  for (const pattern of patterns) {
    const m = raw.match(pattern);
    if (m) {
      return { th: parseInt(m[1], 10), pr: parseInt(m[2], 10) };
    }
  }

  throw new Error(`Unrecognised credit-hours format: "${raw}"`);
}

/**
 * Parse a present/held cell.
 * Distinguishes explicit, defaulted, and missing values.
 * - "explicit": a real digit was parsed (e.g. "18", "0")
 * - "defaulted": a recognised missing marker (e.g. "-") -> 0
 * - "missing": cell was absent entirely -> 0, flagged as missing
 * Unrecognised strings throw; they are never silently converted to zero.
 */
function parseCount(raw: string | undefined): ParsedCount {
  if (raw === undefined) {
    return { value: 0, source: "missing" };
  }

  const s = raw.trim();

  // Explicit numeric value (including zero)
  const n = parseInt(s, 10);
  if (!isNaN(n) && String(n) === s) {
    return { value: n, source: "explicit" };
  }

  // Known missing-value markers for NED format -> defaulted to zero
  const missingMarkers = ["-", "", "N/A", "NA", "null", "nil"];
  if (missingMarkers.includes(s)) {
    return { value: 0, source: "defaulted" };
  }

  // Unreadable / unrecognized value — do not silently convert to zero
  throw new Error(`Expected a number or missing marker, got: "${s}"`);
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
  /** Rows that could not be parsed into courses, with reasons. */
  skippedRows: SkippedRow[];
  /** Printed percentages by course code, when the pct column was detected. */
  printedPcts: Record<string, number | null>;
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

  // Collect all text items across all pages with positions (no classification yet).
  // Each entry: { text, x, y, page }
  const allItems: { text: string; x: number; y: number; page: number }[] = [];
  let foundHeader = false;

  // Track header row items on page 1 for dynamic column detection.
  let headerRowY: number | null = null;
  const headerRowItems: { text: string; x: number }[] = [];

  // Track the first recognised header row on every page. Used later to
  // classify page headers and repeated table headers as metadata.
  const headerRowYByPage = new Map<number, number>();

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const text = item.str.trim();
      if (!text) continue;

      const x = (item.transform as number[])[4];
      const y = (item.transform as number[])[5];

      allItems.push({ text, x, y, page: p });

      const lower = text.toLowerCase();
      const isHeaderToken = Object.values(HEADER_TOKENS).some((tokens) =>
        tokens.some((t) => lower === t),
      );

      if (isHeaderToken) {
        const pageHeaderY = headerRowYByPage.get(p);
        if (pageHeaderY === undefined || Math.abs(y - pageHeaderY) < 4) {
          headerRowYByPage.set(p, y);
        }

        if (p === 1) {
          foundHeader = true;
          if (headerRowY === null || Math.abs(y - headerRowY) < 4) {
            headerRowY = y;
            headerRowItems.push({ text, x });
          }
        }
      }
    }
  }

  if (!foundHeader) {
    throw new Error(
      'PDF layout not recognised: could not find a recognised column header. ' +
      'Accepted headers: "Course Code", "Course", "Subject Code", "Code". ' +
      "Make sure you are uploading a NED Course-Wise Attendance Analysis report.",
    );
  }

  // Dynamic column detection: try to detect anchors from the header row on page 1.
  let colRanges: Record<ColName, { min: number; max: number }>;

  const detectedAnchors = headerRowItems.length > 0
    ? detectColumnAnchors(headerRowItems)
    : null;

  const dynamicRanges = detectedAnchors
    ? buildColRangesFromAnchors(detectedAnchors)
    : null;

  if (dynamicRanges) {
    // Use dynamic ranges (anchors from header row, DEFAULT_COL widths).
    colRanges = dynamicRanges;
  } else {
    // Fall back to default columns. Validate below by checking course output.
    colRanges = DEFAULT_COL as Record<ColName, { min: number; max: number }>;
  }

  // Classify items into rows using the selected column ranges.
  const rowMap = new Map<string, RawRow>();

  for (const item of allItems) {
    const lower = item.text.toLowerCase();
    const isHeaderToken = Object.values(HEADER_TOKENS).some((tokens) =>
      tokens.some((t) => lower === t),
    );

    // Skip header row labels — they are never data cells.
    if (isHeaderToken) continue;

    // Filter repeated header rows on subsequent pages (defensive; already skipped above).
    if (item.page > 1 && isHeaderToken) continue;

    // Filter header row items on page 1 (defensive; already skipped above).
    if (item.page === 1 && headerRowY !== null && Math.abs(item.y - headerRowY) < 4) {
      if (isHeaderToken) continue;
    }

    // Filter obvious page furniture (page numbers at extreme y positions).
    if (/^\d+(\s*of\s*\d+)?$/.test(item.text) && (item.y < 40 || item.y > 800)) continue;

    const col = classifyX(item.x, colRanges);
    if (!col) continue;

    // Include the page in the key: identical y positions on different pages
    // must never be merged into one row.
    const key = `${item.page}:${rowKey(item.y)}`;
    if (!rowMap.has(key)) {
      rowMap.set(key, { y: item.y, page: item.page, cells: {} });
    }
    const row = rowMap.get(key)!;
    row.cells[col] = row.cells[col] ? row.cells[col] + " " + item.text : item.text;
  }

  // Sort by page first, then top-to-bottom within each page
  // (highest y = top in PDF coordinates).
  const sortedRows = [...rowMap.values()].sort(
    (a, b) => a.page - b.page || b.y - a.y,
  );

  const courses: Course[] = [];
  const warnings: ParseWarning[] = [];
  const skippedRows: SkippedRow[] = [];
  const printedPcts: Record<string, number | null> = {};

  const pushIncomplete = (
    row: RawRow,
    code: string | null,
    reason: string,
  ): void => {
    skippedRows.push({
      code,
      reason,
      rowY: row.y,
      page: row.page,
      classification: "incomplete",
    });
  };

  for (const row of sortedRows) {
    const { cells } = row;

    // Classify high-confidence metadata before attempting to read a course.
    // Metadata is reported with an explicit classification, never treated as
    // a course error and never silently dropped.
    const classification = classifyRow(row, headerRowYByPage);
    if (classification?.classification === "metadata") {
      skippedRows.push({
        code: classification.code,
        reason: classification.reason,
        rowY: row.y,
        page: row.page,
        classification: "metadata",
        metadataKind: classification.metadataKind,
      });
      continue;
    }

    if (classification?.classification === "incomplete") {
      // Never silently discard a potential course: account for every row that
      // reached the table-classification stage.
      pushIncomplete(row, classification.code, classification.reason);
      continue;
    }

    const code = cells.code!;
    const credits = cells.credits!;
    const thPresent = cells.thPresent!;

    // Try to parse credits — track as skipped if unrecognised.
    let credParsed: { th: number; pr: number };
    try {
      credParsed = parseCredits(credits);
    } catch {
      pushIncomplete(
        row,
        code,
        `Unrecognised credit-hours format: "${credits}"`,
      );
      continue;
    }

    // Parse counts, distinguishing explicit vs defaulted vs missing.
    let thPresentCount: ParsedCount;
    let thHeldCount: ParsedCount;
    let prPresentCount: ParsedCount;
    let prHeldCount: ParsedCount;

    try {
      thPresentCount = parseCount(thPresent);
      thHeldCount = parseCount(cells.thHeld ?? undefined);
      prPresentCount = parseCount(cells.prPresent ?? undefined);
      prHeldCount = parseCount(cells.prHeld ?? undefined);
    } catch (err) {
      pushIncomplete(
        row,
        code,
        `Unreadable count value: ${err instanceof Error ? err.message : String(err)}`,
      );
      continue;
    }

    // Validation: present must not exceed held.
    if (thPresentCount.value > thHeldCount.value) {
      pushIncomplete(
        row,
        code,
        `Theory present (${thPresentCount.value}) exceeds theory held (${thHeldCount.value})`,
      );
      continue;
    }

    if (prPresentCount.value > prHeldCount.value) {
      pushIncomplete(
        row,
        code,
        `Practical present (${prPresentCount.value}) exceeds practical held (${prHeldCount.value})`,
      );
      continue;
    }

    const course: Course = {
      code,
      thCredits: credParsed.th,
      prCredits: credParsed.pr,
      thPresent: thPresentCount.value,
      thHeld: thHeldCount.value,
      prPresent: prPresentCount.value,
      prHeld: prHeldCount.value,
    };

    // ── Sanity check: compare our computed percentage with the printed one ──
    if (cells.pct !== undefined) {
      const printed = parseFloat(cells.pct);
      printedPcts[code] = isNaN(printed) ? null : printed;
      const computed = computePct(
        thPresentCount.value, thHeldCount.value, credParsed.th,
        prPresentCount.value, prHeldCount.value, credParsed.pr,
      );
      if (!isNaN(printed) && computed !== null) {
        const delta = Math.abs((computed ?? 0) - printed);
        if (delta > 0.1) {
          warnings.push({ code, computed, printed, delta });
        }
      }
    } else {
      printedPcts[code] = null;
    }

    courses.push(course);
  }

  if (courses.length === 0) {
    // If dynamic ranges were used and produced no courses, try default columns
    // as a validated fallback before giving up.
    if (dynamicRanges) {
      // Re-run classification with DEFAULT_COL (this is a validated fallback).
      // For simplicity, we throw; the caller can retry with a different approach.
      throw new Error(
        "PDF layout not recognised: dynamic column detection produced no courses. " +
        "The report may use an unsupported layout.",
      );
    }
    throw new Error(
      "PDF layout not recognised: header was found but no course rows could be parsed. " +
      "The report may be empty or in an unexpected format.",
    );
  }

  return { courses, warnings, skippedRows, printedPcts };
}
