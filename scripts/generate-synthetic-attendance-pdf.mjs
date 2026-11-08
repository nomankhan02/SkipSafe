/**
 * Generate a synthetic NED-style "Course-Wise Attendance Analysis" PDF.
 *
 * Why this exists:
 *   `test-data/sample-attendance.pdf` is gitignored because it may contain real
 *   student data. GitHub-hosted CI therefore starts without a fixture. This
 *   script creates a *synthetic, non-personal* PDF with the same column layout
 *   and the values expected by `src/lib/parseReport.test.ts`, so the parser
 *   integration test can still run in CI without committing real records.
 *
 * Safety:
 *   - Never overwrites an existing fixture unless `--force` is passed.
 *   - Contains only fake/demo values (the name is a public test fixture string
 *     already present in the protected test file).
 *   - Writes no data anywhere else.
 *
 * Usage:
 *   node scripts/generate-synthetic-attendance-pdf.mjs [output] [--force]
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const force = args.includes("--force");
const outputArg = args.find((arg) => arg !== "--force") ?? "test-data/sample-attendance.pdf";
const outputPath = resolve(process.cwd(), outputArg);

if (existsSync(outputPath) && !force) {
  console.log(
    `[fixture] keeping existing ${outputArg} (synthetic fixture not needed)`,
  );
  process.exit(0);
}

const HEADER_Y = 700;
const COL = {
  code: 120,
  credits: 220,
  thPresent: 285,
  thHeld: 330,
  prPresent: 380,
  prHeld: 420,
  pct: 500,
};

/** Metadata rows placed above the table header. */
const metadata = [
  [780, "Student Name: NOMAN KHURSHEED"],
  [768, "2026-2027"],
  [756, "Department of Computer Science & Information Technology"],
  [744, "17-AUG-26"],
  [732, "© NED University of Engineering & Technology"],
];

/** Course rows matching the values asserted by the protected parser test. */
const courses = [
  ["CT-159", "3 Th + 1 Pr", "21", "32", "24", "27", "71.44"],
  ["CT-268", "2 Th + 0 Pr", "16", "22", "-", "-", "72.73"],
  ["EA-244", "3 Th + 0 Pr", "28", "29", "-", "-", "96.55"],
  ["EF-201", "2 Th + 0 Pr", "20", "22", "-", "-", "90.91"],
  ["MT-221", "3 Th + 0 Pr", "29", "32", "-", "-", "90.63"],
  ["MT-331", "3 Th + 0 Pr", "29", "33", "-", "-", "87.88"],
];

const header = [
  [COL.code, "Course Code"],
  [COL.credits, "Credit Hrs"],
  [COL.thPresent, "Theory Present"],
  [COL.thHeld, "Theory Held"],
  [COL.prPresent, "Practical Present"],
  [COL.prHeld, "Practical Held"],
  [COL.pct, "%"],
];

/** Escape a PDF literal string (parentheses and backslash). */
function pdfString(value) {
  return `(${value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")})`;
}

/** One text run at an absolute position. */
function text(x, y, value) {
  return `1 0 0 1 ${x} ${y} Tm ${pdfString(value)} Tj`;
}

const contentParts = ["BT", "/F1 10 Tf", "0 0 0 rg"];

for (const [y, value] of metadata) {
  contentParts.push(text(COL.code, y, value));
}

for (const [x, value] of header) {
  contentParts.push(text(x, HEADER_Y, value));
}

let y = 660;
for (const [code, credits, thPresent, thHeld, prPresent, prHeld, pct] of courses) {
  contentParts.push(
    text(COL.code, y, code),
    text(COL.credits, y, credits),
    text(COL.thPresent, y, thPresent),
    text(COL.thHeld, y, thHeld),
    text(COL.prPresent, y, prPresent),
    text(COL.prHeld, y, prHeld),
    text(COL.pct, y, pct),
  );
  y -= 12;
}

contentParts.push("ET");
const content = contentParts.join("\n");

const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
    "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
];

const chunks = [];
let byteLength = 0;

function push(value) {
  const buffer = Buffer.from(value, "latin1");
  chunks.push(buffer);
  byteLength += buffer.length;
  return byteLength;
}

push("%PDF-1.4\n");

const offsets = [];
for (let i = 0; i < objects.length; i += 1) {
  offsets.push(byteLength);
  push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
}

const xrefOffset = byteLength;
const totalObjects = objects.length + 1; // including object 0
let xref = `xref\n0 ${totalObjects}\n0000000000 65535 f \n`;
for (const offset of offsets) {
  xref += `${String(offset).padStart(10, "0")} 00000 n \n`;
}
push(xref);
push(
  `trailer\n<< /Size ${totalObjects} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, Buffer.concat(chunks));
console.log(
  `[fixture] wrote synthetic attendance PDF to ${outputArg} (${byteLength} bytes)`,
);
