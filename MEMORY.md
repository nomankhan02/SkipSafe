# MEMORY.md — SkipSafe permanent project knowledge

Source of truth for a new AI session or model.

**`AGENTS.md` is Next.js-generated tooling guidance — do not overwrite, rewrite, or strip its block.**
**`.agents/rules/skipsafe.md` is an always-on project rule file — keep it; this file supplements it, it does not replace it.**
**`TASKS.md` is the operational roadmap — keep MEMORY.md and TASKS.md in agreement.**

> Documentation status: rewritten 2026-10-31 after a historical audit of git history and the baseline commit `90b0185`; updated 2026-11-03 for Parser Phase P1/P1.1 and the Phase P2 PDF upload integration; updated 2026-11-07 for the automated testing, privacy-regression, CI and security-scanning foundation (Phase T); updated 2026-11-08 for the `shadcn` devDependency move (production audit now clean); updated 2026-11-08 for Milestone 1 (NED connection boundary and UI), and updated 2026-11-09 for Milestone 2 (real NED undergraduate attendance-PDF retrieval through the authenticated session; real-account smoke test still pending). Claims below are verified against code, builds and test runs unless explicitly marked unverified.

---

## 1. Project identity

**What SkipSafe is:** A local-first web app that helps university students track course attendance, see exam-eligibility risk, and know how many classes they can still safely skip.

**Intended users:** Undergraduate university students (NED-style semester structure in current data/tests) who must maintain ≥75% attendance per course to sit exams.

**Problem it solves:** Students often discover they are below 75% too late. Manual portal math is error-prone; SkipSafe turns attendance data (PDF today, portal/manual later) into clear per-course status, skip budgets, and warnings.

**Product vision:** A calm, trustworthy attendance companion — not a grade calculator. It informs decisions (e.g., "can I skip this class?") while making clear the **official university record is authoritative**.

---

## 2. Product functionality

### Built and verified in code

- Per-course attendance percentage matching the portal (credit-weighted theory + practical).
- Status vocabulary: `not_started` | `safe` | `warning` | `danger`. In code: `not_started` (no classes held), `danger` (current < 75% or projected final < 75%), `warning` (`cur >= 75 && hardSkips <= 2`), `safe` (otherwise).
- **Skips left**: `hardSkips` (classes a student can skip while maintaining ≥75% attendance) assuming all remaining classes are attended. The 80% safety cushion was dropped completely; 75% is the sole eligibility threshold (`safeSkips` and `SAFE_LIMIT` removed from engine).
- Semester summary: courses at risk, lowest course, safest course.
- PDF parser for NED "Course-Wise Attendance Analysis" reports (`parseAttendanceReport`) — flexible headers, dynamic column detection, multiple credit formats, missing-value handling, metadata/incomplete row classification, skipped-row accounting, validation, printed-% comparison and multi-page support. Built, tested and wired into the dashboard.
- Dashboard rendering uploaded or NED-retrieved `Course[]` through `analyzeCourse`/`getAttendanceSummary` (no math in UI). The app has no mock data; the dashboard renders only a report retrieved from NED or uploaded by the user (with an empty state when none is loaded). PDF upload and parsing happen entirely in the browser; parsed courses live in React state only. Numbers in `attendance.test.ts` and `courseCardDisplay.test.ts` are synthetic unit-test fixtures only.
- Swiss-editorial dashboard: masthead + SS monogram, summary readout band, responsive compact course-box grid (1 col mobile, 2 sm, 3 lg) with Skips Left as primary collapsed readout and inline expandable attendance details, `AttendanceScale` SVG (75% limit tick), geometric status symbols (safe check, limit reached diamond, danger cross, not started dash), Light/Dim/Dark themes with cycling switch and pre-hydration theme script.
- Ask SkipSafe header button exists; handler is still a stub (`onClick={() => {}}`).

### Attendance tracking workflow (intended end-state)

1. Student obtains attendance data (today: NED portal download via `/connect` or manual PDF upload; the app has no mock data).
2. Parser/`Course[]` feeds `analyzeAll` / `getAttendanceSummary`.
3. Dashboard shows status, %, skips left, parser warnings and incomplete rows.
4. Student uses skip guidance before missing class.

### University portal & manual CAPTCHA (implemented; real-account smoke test pending)

- **Implemented:** a responsive NED connection panel on the dashboard, typed client/server contracts, four server route handlers, an isolated temporary-session design, and real undergraduate attendance-PDF retrieval through the authenticated portal session. After a successful connect the PDF is fetched automatically, returned to the browser in memory, and fed into the existing client-side parser; a retry control covers transient failures and manual upload remains the fallback.
- **Verified public contract (2026-11-09):** `POST https://pl.neduet.edu.pk/index.jsp` with `portal_id`, `pwd_portal`, `vericode`, `usertype=Undergraduate`, `hd_stat5=5`, `login`; CAPTCHA at `/captchaportal` sets an HttpOnly/Secure `JSESSIONID`; `/undergrad/jsp_to_pdf_servlet` requires that session and redirects to login without it; the attendance link uses `p=<studentId>_attendancecard`.
- **Live caveat:** the authenticated PDF download still needs a real-account smoke test after any portal change. Failure is explicit; login HTML or non-PDF data is never treated as a report. The manual PDF upload remains the fallback.
- **CAPTCHA stays manual/human.** No bypass, OCR, automation or third-party CAPTCHA service.
- **Credentials are transient:** sent over HTTPS to this app's server only for a connection attempt, never written to a session record, storage, logs or response. JavaScript cannot guarantee memory zeroisation; the design minimises lifetime and drops references after the attempt.
- **Sessions:** opaque 256-bit IDs, server-memory only, 5-minute TTL, per-session isolation, `HttpOnly`/`SameSite=Strict`/path-scoped cookie, Secure on HTTPS. No session ID is returned in JSON or a URL. In-memory storage is process-local and **not reliable on multi-instance serverless hosting** (see §9).
- **Before live deployment:** terms/permission review, hosting log-retention audit, and a reviewed shared session store if deployment is multi-instance.

### PDF attendance report processing (built, tested)

- `src/lib/parseReport.ts` — position-based pdfjs parsing (dynamic column anchors with validated defaults, page-aware y-row keys).
- Detects flexible header tokens (course code/course/subject code/code) and rejects wrong layouts with clear errors.
- Supports multiple credit formats, explicit/defaulted/missing count values, present ≤ held validation, multi-page reports and printed-% comparison.
- Classifies high-confidence metadata (student info, academic year, dates, department headings, table/page furniture, summaries, notes, footer) separately from `incomplete` course rows. Ambiguous rows are returned, never silently discarded.
- **Never logs PDF bytes or extracted text.** Returns `Course[]`, `warnings[]`, classified `skippedRows[]` and `printedPcts`.
- Synthetic fixture: `test-data/sample-attendance.pdf` (git-ignored, produced via `npm run generate:fixture`). Real attendance PDFs are never kept in the repo.

### Chatbot "Ask SkipSafe" (planned, not built — Phase 4)

- **Intended scope (approved direction, not yet implemented):** entry copy exactly "Schedule changed? Ask SkipSafe."; five exact suggested questions; answers only from `attendance.ts` outputs; honest placeholder until real answers ship.
- **Intended limits (product policy):**
  - Answers only about attendance math/meaning for **this student's local data**.
  - Must **not** invent percentages — only values from `attendance.ts` / parsed `Course[]`.
  - Client-only conversations by default; no server-side chat retention without explicit design approval.
  - If an LLM is used: key stays **server-side**; no `NEXT_PUBLIC_` secrets; no PDF exfiltration.
  - No academic/medical/legal advice; eligibility always defers to the university record.

---

## 3. Technical architecture

### Stack & versions (`package.json`, verified 2026-11-08)

| Area | Choice |
|------|--------|
| Framework | `next` **16.4.3** (exact pin; was 16.4.0 — upgraded in Phase S) |
| React | **19.3.1** / `react-dom` 19.3.1 (exact pins; was 19.3.0) |
| Lint config | `eslint-config-next` **16.4.3** (exact pin) |
| Language | TypeScript ~5.9 |
| Styling | Tailwind CSS v4 + `@tailwindcss/turbopack`, `tw-animate-css`, `shadcn/tailwind.css`; oklch tokens. **`shadcn` is a devDependency** — build-time CSS import + CLI only, no runtime JS import. |
| Fonts | `next/font/google`: Bricolage Grotesque (headings), Figtree (body), **Silkscreen** (pixel numerals, panel readouts only). Geist Mono loader **removed** in Phase 3; `--font-mono` = system stack for `code`/`kbd`. |
| Components | shadcn-style primitives in `src/components/ui/` (button, card, badge, input, label, toggle — **morphing-popover retired from use**, see §8) |
| Animation | `framer-motion`/`motion` 14.x (entrance fades, scale-fill; all reduced-motion guarded) |
| 3D/canvas (retired) | `three`, `@react-three/fiber`, `@react-three/drei`, `lenis` still **installed** but unused by any live UI — removal is a Phase 5 decision requiring explicit approval |
| Icons | `lucide-react` (no emoji); pixel status glyphs are hand-built SVG |
| PDF | `pdfjs-dist` (devDependency; dynamic import in parser) |
| Tests | Plain Node `assert` via `tsx`; `npm test` runs attendance + parser + NED connection + privacy suites |
| CI/tooling | GitHub Actions CI (types, lint, tests, build, audit), CodeQL, Dependabot; no E2E runner yet |

`next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, Turbopack CSS rule for Tailwind.

### Project structure

```text
AGENTS.md                 # Next.js-generated block + permanent SkipSafe instructions
.github/                  # CI, CodeQL, Dependabot
.agent/skills/            # Project skill: ui-ux-pro-max (singular ".agent")
.agents/rules/skipsafe.md # Always-on rules — keep; update only when architecture changes
MEMORY.md / TASKS.md      # This file + operational roadmap
scripts/                  # Synthetic (non-personal) PDF fixture generator for CI
src/
  app/
    layout.tsx            # 3 next/font loaders + themeInit inline script + data-theme="light"
    page.tsx              # redirect → /dashboard
    dashboard/page.tsx    # Main UI (React state only, no persistence)
    api/ned/session/      # Reviewed server boundary: challenge, connect, disconnect
    globals.css           # Tailwind v4 + oklch tokens + 3 themes + status tokens + transition base
  components/
    SSMonogram.tsx        # Static carved/interlocked SS monogram (currentColor)
    NedConnection.tsx     # NED student-ID/password/manual-CAPTCHA connection panel (client)
    AttendanceScale.tsx   # SVG scale with 75% limit tick (client, framer fill)
    StatusSymbol.tsx      # Geometric status marks (safe/limit/danger/not_started)
    ReportUpload.tsx      # Client PDF picker/replace/clear control
    ParseNotices.tsx      # Parser warnings + incomplete rows + metadata summary
    PixelStatusSymbol.tsx # Legacy 7×7 pixel-art glyphs (aliased by StatusSymbol)
    BackgroundParticleCanvas.tsx / CardParticleCanvas.tsx /
    ParticleNumber.tsx / Interactive3DLogo.tsx
                          # RETIRED: on disk, not imported by any live page (Phase 5 deletions)
    ui/                   # shadcn primitives (+ morphing-popover.tsx, retired from use)
  lib/
    attendance.ts         # PURE logic — PROTECTED
    attendance.test.ts    # PROTECTED
    parseReport.ts        # PDF parser — PROTECTED
    parseReport.test.ts   # PROTECTED
    privacy.test.ts       # Privacy regression suite (source + optional bundle scan)
    ned/                  # NED boundary: shared types/validation/state + server-only
                          # session store, cookies, adapter contract, handlers, tests
    pdfWorker.ts          # Browser PDF.js worker asset setup
    mockCourses.ts        # retired test fixtures; not used by the live app
    utils.ts, try.ts      # try.ts is an unimported developer scratch script
test-data/sample-attendance.pdf  # git-ignored synthetic fixture (generated via npm run generate:fixture); real PDFs are never kept in repo
```

### Key component responsibilities

- **`attendance.ts`:** `currentPercent`, `skipsLeft`, `analyzeCourse`, `analyzeAll`, `getAttendanceSummary`; constants `WEEKS_PER_SEMESTER`, `HARD_LIMIT`, `WARNING_THRESHOLD`; types `Course`, `Status`, `CourseResult`, `SummaryReport`.
- **`parseReport.ts`:** `parseAttendanceReport(pdfData) → { courses, warnings, skippedRows, printedPcts }`; `classifyRow` exposes pure metadata/incomplete classification for tests.
- **`pdfWorker.ts`:** configures `GlobalWorkerOptions.workerSrc` from the bundled PDF.js worker asset in the browser.
- **`ReportUpload.tsx`:** PDF picker/replace/clear UI; parsing is initiated by the dashboard, all local.
- **`NedConnection.tsx`:** controlled student-ID/password/CAPTCHA form; manual CAPTCHA only; clears all sensitive fields after every connect attempt; same-origin fetches only; never touches browser storage or server-only modules.
- **`lib/ned/`:** shared `types`/`validation`/`connectionState` plus server-only `sessionStore`, `cookies`, `portalAdapter`, `handlers` and `runtime`. The adapter implements the verified NED undergraduate challenge/login/attendance request flow; an `unconfiguredNedAdapter` remains available as an explicit fail-closed fallback.
- **`ParseNotices.tsx`:** renders warnings and `incomplete` rows; metadata is summarized neutrally, never as an error.
- **`dashboard/page.tsx`:** presentation only; holds real report state in React state (empty state when no report is loaded; no mock data); maps active courses through `analyzeCourse`; theme store (useSyncExternalStore + MutationObserver); never reimplements math.
- **`AttendanceScale.tsx`:** `role="progressbar"` SVG, 1 unit = 1% (`viewBox 0 0 100 6`), tick at HARD_LIMIT, reduced-motion-guarded fill.
- **`StatusSymbol.tsx`:** restrained geometric stroke marks, always paired with a visible text label.

### How the app currently works

1. `/` redirects to `/dashboard`.
2. `layout.tsx` runs a validated localStorage `themeInit` script pre-hydration; `<html data-theme="light" suppressHydrationWarning>`.
3. Dashboard shows the empty state when no report is loaded (with connect and upload actions), rendering course cards only after a real report is retrieved from NED or uploaded by the user.
4. The NED panel requests a CAPTCHA from `/api/ned/session/challenge`, submits ID/password/CAPTCHA to `/api/ned/session/connect`, retrieves the attendance PDF from `/api/ned/session/attendance` after connecting, and disconnects via `/api/ned/session`. The server uses the portal's `JSESSIONID` for the PDF request and returns the bytes in memory; expired sessions surface `session_expired` and clear the session.
5. Uploading a PDF (or receiving the retrieved NED PDF) reads it locally, configures the PDF.js worker, calls `parseAttendanceReport`, stores the resulting `Course[]` in React state and renders warnings/incomplete rows.
6. Active courses from the real loaded report map through `analyzeCourse` + `getAttendanceSummary`; the grid, summary band and expanded details update.
7. Replacing a report only updates state on success; failed uploads keep the previous report. Clear resets report state to null (empty state).
8. No PDF bytes, attendance data or parsed reports are written to storage or any database. A NED-retrieved PDF transits this app's server **in memory only** for the authenticated portal request, is returned to the browser, and is never logged or persisted. NED credentials are sent only to this app's server for a connection attempt and are never stored in a session record.

---

## 4. Attendance rules and assumptions

| Rule | Value / behavior | Where |
|------|------------------|-------|
| Exam eligibility | **75%** per course (sole product threshold; 80% cushion dropped) | `HARD_LIMIT` |
| Warning rule (code) | `cur >= 75 && hardSkips <= WARNING_THRESHOLD (2)` | `WARNING_THRESHOLD` in engine |
| **Semester length** | **15 teaching weeks** (`WEEKS_PER_SEMESTER = 15`); set by approved Phase C change (was 16 at initial build — superseded) | `attendance.ts`, `attendance.test.ts` |
| Calendar model | 16 calendar weeks minus 1 midterm week → 15 teaching weeks; UI copy states this | product narrative + dashboard copy |
| Default theory planned | `thCredits * WEEKS_PER_SEMESTER` (×15) unless `thPlanned` override | `projectedFinal` / `skipsLeft` |
| Default practical planned | `prPlanned ?? prHeld` (no assumed future practicals unless overridden) | `projectedFinal` |
| Projection model | Student **attends all remaining** classes; only extra **theory** skips counted | `skipsLeft` |
| Current % formula | Credit-weighted theory+practical, 2-decimal rounding, matches portal | `currentPercent` |
| Not started | `thHeld === 0 && prHeld === 0` → `null` / `not_started` | — |
| Float safety | epsilon `1e-9` so exactly 75.0 counts as OK | `skipsLeft` |
| Skip budgets | Increment while next skip still ≥ threshold; floor at 0 | — |
| Official disclaimer | Estimates only; university record decides eligibility | dashboard footer |

**Historical note (preserved):** the original code shipped `WEEKS_PER_SEMESTER = 16` while the product assumption was 15 teaching weeks. This discrepancy was explicitly approved and corrected in Phase C (code + tests changed together). The 16 value must not be reintroduced.

---

## 5. Protected files and regression gate

**The attendance calculation logic and the PDF parser are implemented, tested, and working correctly. Do not rebuild, rewrite, or "refactor for fun."**

| Asset | Protection rule |
|-------|-----------------|
| `src/lib/attendance.ts` | Pure module; no UI/network imports; changes only with explicit approval + test updates |
| `src/lib/attendance.test.ts` | Numbers are synthetic unit-test fixtures only; do not loosen asserts |
| `src/lib/parseReport.ts` | Keep privacy (no logging of PDF); position-based parsing is intentional |
| `src/lib/parseReport.test.ts` | Uses synthetic PDF fixture generated by npm run generate:fixture; keep byte privacy |
| `Course` type, `Status` vocabulary, `getAttendanceSummary` | Stable; UI depends on them |
| `mockCourses.ts` | Retired fixture file — not imported or used by live app code |

**Regression gate after any change:**

```bash
npm run typecheck
npm run lint
npm run test:attendance
npm run test:parser        # fixture generated via npm run generate:fixture
npm run test:ned           # NED boundary/session/privacy-adjacent unit tests
npm run build
npm run test:privacy       # after build, so the client-bundle scan runs
npm audit --omit=dev
```

CI (`.github/workflows/ci.yml`) runs the same gate on every push and pull request. `npm test` runs the test suites. Real attendance PDFs are never kept in the repo; `test-data/` is git-ignored and holds only a synthetic fixture produced by `npm run generate:fixture` (`scripts/generate-synthetic-attendance-pdf.mjs` creates a non-personal fixture in CI and never overwrites an existing file). The protected test files remain unchanged.

---

## 6. Design system (authoritative — current, implemented)

The dashboard **has been redesigned** to the target Swiss-editorial/instrument-panel direction (Phases 1–3). What follows is the live system; do not resurrect the legacy style.

### 6a. Visual direction

- **Swiss editorial + architectural minimalism + retro instrument-panel readouts** inside course panels.
- **Light foundation**, hairline borders, sharp geometry (`--radius: 0.125rem`), flat surfaces.
- **Forbidden:** glassmorphism, neon, gradients, glossy effects, heavy shadows, generic SaaS card grids, bulky rounded corners, rotating 3D, particles, WebGL.
- Information design like a precision instrument: dense but legible, clear rules and dividers, restrained accents used only for meaning.
- Course panels deliberately evoke a **minimalist retro pixel-game screen** — square geometry, thin borders, restrained contrast — arranged in a responsive grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`). Skips left serves as the primary collapsed readout (`text-[40px] sm:text-[44px]` weight 700 Silkscreen), with attendance percentage displayed upon expansion (`text-[28px] sm:text-[32px]` weight 700 Silkscreen).
- **Pixel status symbols (historical)**: Restrained marks distinguishing safe (skips remaining), warning / limit reached (0 skips left), danger / ineligible (<75% or unrecoverable), and not started.

### 6b. Typography (four roles — Phase 3 correction, supersedes the old mono-for-labels rule)

| Role | Font | Usage rules |
|------|------|-------------|
| Headings & display numbers | **Bricolage Grotesque** (`font-bricolage`) | h1–h6 via base layer; summary-band display numbers; course panel collapsed skips left (`text-[40px] sm:text-[44px]` tabular-nums); expanded attendance percentage (`text-[28px] sm:text-[32px]` tabular-nums); scale tags |
| Body + all ordinary text | **Figtree** (`font-sans`) | labels, descriptions, metadata, status text, panel subcopy — **never use monospace for ordinary small text** |
| `code`/`kbd`/toggle marks | system mono (`--font-mono`) | `[-]`/`[+]` controls, code, kbd |

*(Silkscreen and arcade pixel font readouts are superseded as of the Phase 3R editorial refinement).*

### 6c. Themes (exactly three)

- `:root` = **Light**, `:root[data-theme="dim"]`, `:root[data-theme="dark"]`; `@custom-variant dark` maps to `[data-theme="dark"]`.
- Persistence: `localStorage["theme"]` + pre-hydration `themeInit` inline script (no flash; pattern from local Next docs `preventing-flash-before-hydration.md`).
- UI: single cycling switch — Light → Dim → Dark → Light; active swatch = filled square + `border-2 border-foreground`; dynamic `aria-label` carries state.
- Transitions: global 260ms color-only transitions under `@media (prefers-reduced-motion: no-preference)` in the base layer.

### 6d. Status system

- Tokens `--status-safe` / `--status-warning` / `--status-danger` per theme + `@theme` mappings (`text-status-*`, `border-status-*`, `bg-status-*`, `fill-status-*`).
- Never color alone — pixel symbol + text label always; **red only for actual danger**.

### 6e. SS monogram

- Static 40×40 SVG (`SSMonogram.tsx`): layered square slabs (back `opacity .25`), two carved blocky-S cutouts that overlap/interlock via a white-halo over/under mask trick, offset carve-floor copies (`opacity .16`) for depth. `currentColor`, no gradient/rotation/animation. Each S stays individually recognizable.

---

## 7. Development history (verified)

Git contains **5 commits** up through the initial editorial dashboard baseline commit `90b0185`:

| Commit | Date | Content |
|--------|------|---------|
| `e4f57c3` | 2026-10-12 | Bootstrap (Next 16.4.0, TS, Tailwind v4), attendance logic + tests, ui-ux-pro-max skill |
| `5d50302` | 2026-10-12 | PDF parser + tests |
| `b1afd54` | 2026-10-12 | Dashboard (mock data) |
| `b59ad2c` | 2026-10-14 | Legacy UI WIP: particles, theme toggle, 3D logo |
| `90b0185` | 2026-10-31 | feat: establish SkipSafe editorial dashboard and attendance UI (Phases S, C, 1, 2, 2R, 3) |

Approved phased work (Phases S–3 committed in `90b0185`; Phase 3R uncommitted work in progress):

1. **Initial audit** — architecture inventory, calculator/parser verification (both test suites green), lint/build baseline (36 errors/9 warnings at the time), dependency audit, security findings, MEMORY/TASKS created after approval.
2. **Phase S (security)** — `next` 16.4.0 → **16.4.3**, `react`/`react-dom` 19.3.0 → **19.3.1**, `eslint-config-next` → 16.4.3 (exact pins preserved). Verified via npm view + OSV API (16.4.0 advisories: GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r; 16.4.3 clean). Remaining 28 dev-toolchain findings (shadcn/eslint/undici trees) — no `npm audit fix --force`.
3. **Phase C (semester correction)** — `WEEKS_PER_SEMESTER` 16 → **15** in protected code with explicit approval; tests re-based (hardSkips: CT-159 10, CT-268 3, EA-244 10, EF-201 7, MT-221 9, MT-331 7; XX-101 edge case → `th("XX-101", 4, 45, 60)`); dashboard copy interpolated from constants. Parser + held data untouched.
4. **Phase 1 (design foundation)** — oklch Swiss-editorial tokens for 3 themes via `data-theme`; `--radius: 0.125rem`; Bricolage/Figtree/(then)Geist Mono via `next/font`; base-layer heading font + tabular-nums rule; `themeInit` anti-flash script.
5. **Phase 2 (editorial chrome)** — `bg-background` main; masthead with SSMonogram + metadata rail; flat 3-column summary readout band (replacing glass stat cards, ParticleNumber removed from use); flattened course cards; status tokens replacing neon classes; flat footer.
6. **Phase 2 refinements** — single cycling theme switch (filled active swatch + strong border); global reduced-motion-guarded color transitions; popover tokenized (all three themes); `v1.2` chip removed; monogram interlock + layered-carved depth.
7. **Phase 3 (course interface, 2026-10-31)** — course cards → Swiss-editorial instrument rows (header strip button with `aria-expanded`/`aria-controls` + recessed "screen" area); `AttendanceScale` SVG; `PixelStatusSymbol` 7×7 glyphs; Silkscreen integrated as `font-pixel`; Geist Mono loader removed; MorphingPopover retired from dashboard. Committed in `90b0185`. *(Superseded by Phase 3R)*.
8. **Phase 3R (responsive compact course grid & Swiss editorial refinement, 2026-10-31)** — redesigned course interface from single-column stacked accordion rows to a responsive compact grid: `grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-3` (`items-start` prevents neighboring boxes from stretching when one card opens). Simplified attendance allowance: removed safety cushion concept entirely from the UI. Display one clear metric: **"Skips left"** (calculated directly via `analysis.hardSkips` for $\ge 75\%$). Elevated Skips Left to headline collapsed readout (`text-[40px] sm:text-[44px]` Bricolage Grotesque, tabular-nums, bold); course names heightened in visual priority (`text-lg font-bold font-bricolage`); smooth drawer animation (`AnimatePresence` height and opacity with `[0.16, 1, 0.3, 1]` cubic-bezier easing, respecting `useReducedMotion`). Restrained, theme-aware geometric stroke marks in `StatusSymbol.tsx` (check, limit diamond, danger cross, not started dash).
9. **Parser Phase P1 (2026-11, uncommitted)** — flexible header tokens, dynamic column anchors with validated defaults, multiple credit formats, explicit/defaulted/missing value handling, row validation, printed-percentage comparison, skipped-row tracking and multi-page support. New verified PDF fixture replaced the old one; the old regression test remains structure-only because the old PDF file itself was not preserved.
10. **Parser Phase P1.1 (2026-11-03, uncommitted)** — robust row classification: high-confidence metadata (student info, academic year, dates, department headings, table/page furniture, summaries, notes, footer) is classified separately from `incomplete` course rows; metadata rows are never presented as course errors; the old silent-discard branch now accounts for every potential course row; page-aware row keys fix cross-page merging; `SkippedRow` and `classifyRow` are exported for tests.
11. **Phase P2 (PDF upload integration, 2026-11-03, uncommitted)** — browser-only upload flow: validated file picker, bundled PDF.js worker, `parseAttendanceReport → Course[] → attendance.ts → dashboard`, parser warnings/incomplete-row display, replace/clear flows, previous-report retention on failure. Parsed courses are held in React state only; no localStorage/IndexedDB/backend; mock data fallback was later removed.
12. **Phase T (automated testing & security foundation, 2026-11-07, uncommitted)** — `npm test`/`test:*`/`typecheck` scripts; privacy regression suite; synthetic PDF fixture generator for CI; GitHub Actions CI (typecheck, lint, attendance/parser/privacy tests, production build, dependency audit), CodeQL, Dependabot; baseline security headers/CSP in `next.config.ts`; retired-file lint cleanup (0 errors/warnings); `npm audit fix` (non-breaking) reduced production findings to 6 low/moderate, all in the shadcn CLI tree. ZAP was evaluated but **not run** (no staging environment).
13. **Dependency audit remediation (2026-11-08, uncommitted)** — `shadcn` moved from `dependencies` to `devDependencies` (same resolved version `4.23.0`, lockfile synced with `npm install --package-lock-only`; no `--force`, no breaking upgrade). Verified no runtime JS import: `src/app/globals.css` imports `shadcn/tailwind.css` at build time and `components.json` drives the CLI. This moved `deepmerge@4.3.1` (low) and `minimatch@10.2.6` (moderate) under `dev`, making **`npm audit --omit=dev` clean (0 findings)**. Full-tree audit still shows 13 dev-only findings (2 low, 11 moderate) via `shadcn`/`eslint-config-next`/`typescript-eslint`; these are build/lint tooling, not shipped runtime code. Production build output CSS kept the same hashed filename and size (`324t2cu46ur1y.css`, 60,503 bytes).
14. **Milestone 1 — NED connection foundation (2026-11-08, uncommitted)** — responsive NED panel on the dashboard (student ID, password, manual CAPTCHA, refresh, connect, disconnect); typed shared contracts; fail-closed `NedPortalAdapter`; three reviewed route handlers (`POST challenge`, `POST connect`, `DELETE session`); per-session in-memory store with 256-bit opaque IDs, 5-minute TTL, isolation and no credential fields; `HttpOnly`/`SameSite=Strict`/path-scoped/Secure cookie; origin/content-type/size/JSON hardening; 10-second operation timeout; field validation and explicit loading/invalid-credentials/CAPTCHA/portal/timeout/success states; `test:ned` suite; privacy tests extended with an exact route/fetch allowlist and server-only bundle checks. No live NED endpoint was invented or contacted; authentication remained non-functional by design.
15. **Milestone 2 — real NED attendance retrieval (2026-11-09, uncommitted)** — replaced the fail-closed default adapter with a live undergraduate adapter for the verified public contract (`/captchaportal` CAPTCHA + `JSESSIONID`, `POST /index.jsp` login fields, `/undergrad/jsp_to_pdf_servlet?p=<studentId>_attendancecard`); added `POST /api/ned/session/attendance`; validates content type, size and `%PDF-` magic so HTML/login pages are never treated as a report; maps expiry/401/403/login redirect to `session_expired` and clears the session; auto-retrieves the PDF after connect and parses it in the browser; retry button and manual upload fallback; adapter/handler tests cover endpoints, cookies, card ID, rejection, HTML-as-PDF, expiry and invalid PDF. **The authenticated download has not been smoke-tested against a real student account.**

**Superseded decisions (kept for history, do not restore):** 16-week constant; safety cushion (80%) in UI / separate safe skips readout (superseded in Phase 3R simplification); mock data fallback / MOCK_COURSES (superseded; app has no mock data and renders only real reports retrieved from NED or uploaded by the user); dark-only slate/glassmorphism UI; 3D rotating logo; particle canvases/ParticleNumber in live UI; Geist Mono for ordinary labels; three-button segmented theme control; card-grid course layout (pre-redesign); full-width single-column stacked rows (Phase 3); Silkscreen / pixel font for numeric readouts (superseded in Phase 3R refinement); double-framed arcade pixel glyphs (superseded in Phase 3R refinement); unconstrained grid stretching across row items (superseded by `items-start`); instant accordion jump (superseded by smooth drawer animation); popover-based details; `v1.2` version chip; `.dark` class toggling.

---

## 8. Retired-but-on-disk assets (Phase 5 candidates — do not resurrect, do not delete without approval)

- `Interactive3DLogo.tsx`, `BackgroundParticleCanvas.tsx`, `CardParticleCanvas.tsx`, `ParticleNumber.tsx` — not imported by any live page.
- `ui/morphing-popover.tsx` — no longer imported by the dashboard; contains the 2 known lint errors (Phase 5).
- npm deps now unused by live UI: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `lenis` — **removal requires explicit approval** (no dependency removals happened in Phases 1–3).
- Known lint baseline: **0 errors / 0 warnings** after the Phase T cleanup (targeted `prefer-const`/unused-variable fixes and scoped suppressions in retired files). Live dashboard/components remain lint-clean.

---

## 9. Privacy and security

1. **No password storage or logging** — ever (portal or otherwise).
2. **Attendance data stays local in the browser.** PDF uploads are parsed client-side and parsed courses live only in React state; no localStorage/IndexedDB persistence, backend DB or external attendance API is used. A NED-retrieved PDF transits this app's server in memory for the authenticated portal request and is returned to the browser; it is never logged, written to storage or kept after the response. NED credentials are sent to this app's server only for a connection attempt and are never written to a session record, response, log or storage.
3. **NED server session state is temporary and process-local.** It holds only opaque adapter state (never credentials/CAPTCHA answers), uses 256-bit random IDs with a 5-minute TTL, and is isolated per session.
4. **API keys remain server-side** (route handlers / server actions only).
5. **No `NEXT_PUBLIC_` exposure of secrets.**
6. **Never commit** `.env*`, real student PDFs, or personal data. Real attendance PDFs are never kept in the repo; `test-data/` is git-ignored and holds only a synthetic fixture produced by `npm run generate:fixture`.
7. **Never log** request bodies, credentials, CAPTCHA answers, cookies, tokens, PDF binaries, extracted PDF text or attendance data.
8. CAPTCHA stays manual — no bypass, OCR, automation or third-party CAPTCHA service.
9. Chatbot (when built) must not send student data to third parties without explicit design approval.

### Verified vs unverified privacy claims (2026-11-08, Milestone 1; retrieval added 2026-11-09)

Verified by source inspection, `src/lib/ned/ned.test.ts` and `src/lib/privacy.test.ts`:

- No `sessionStorage`, IndexedDB, client cookies or database code exists; `localStorage` is used only for the `theme` key. The NED session cookie is server-set `HttpOnly`/`SameSite=Strict`/path-scoped and not readable by frontend JavaScript.
- No runtime `console.*`/stdout logging exists; the parser has no logging.
- The only client `fetch` calls are relative same-origin `/api/ned/...` requests in `NedConnection.tsx`; no external URLs, XHR, WebSocket, beacon, analytics SDKs or third-party scripts exist.
- Exactly four reviewed route handlers exist (`session`, `session/challenge`, `session/connect`, `session/attendance`) with no server actions, database drivers or file writes.
- Session records contain only `createdAt`, `expiresAt`, `phase` and opaque `portalState`; `portalState` may hold the portal `JSESSIONID` cookie and the attendance-card identifier, but tests assert credentials/CAPTCHA answers are absent.
- The attendance handler validates the portal response as a real PDF (`%PDF-` magic, size limits) and returns explicit failure for HTML/login pages; the retrieved bytes are passed through in memory and not logged or written to disk.
- Failed/expired/disconnected sessions are deleted and cookies cleared; challenge refresh replaces the previous session; deleting one session does not affect another.
- `ParseResult` exposes only `courses`, `warnings`, `skippedRows`, `printedPcts` — never raw PDF bytes or extracted text.
- The dashboard keeps parsed courses in React state; clear resets it; the file input is reset after selection.
- The NED form clears student ID, password and CAPTCHA answer after every connect attempt; it never writes them to storage.
- No `NEXT_PUBLIC_`/client `process.env` usage; the built client bundle contains no fixture identifiers, secret shapes, `.env` values or server session internals.

Partially verified / not verifiable in this repo:

- **Live NED retrieval is implemented but not smoke-tested with a real student account.** The request contract is verified against the public portal and an independent working implementation, and all failure paths are exercised with fake adapters; the authenticated PDF body itself has not been confirmed end-to-end. If the portal changes, retrieval fails explicitly rather than fabricating data.
- Student credentials do reach this app's server during a connection attempt (and the portal session cookie is held in memory for the temporary session); they are never persisted or logged.
- The in-memory session store is **not safe for multi-instance/serverless deployments** (instances do not share memory, and cold starts drop sessions). A reviewed temporary store and sticky/single-instance deployment decision are required before shipping live auth.
- Hosting-provider logs, CDN request tracing, platform crash reporting and error-monitoring retention are **not** covered by application code and have not been audited. No hosting provider is confirmed. HTTPS is required in deployment; request metadata and potential provider retention must be documented before live credentials are accepted.
- GitHub secret scanning/push protection is a repository setting, not code; it must be enabled in GitHub settings.
- OWASP ZAP dynamic scanning was **not** performed; there is no staging environment. Do not treat a green CI run as proof of full security.
- Cross-user isolation and cleanup are tested at the store/handler level with fake adapters, not against the real portal or multiple server instances.

---

## 10. Development conventions

### Mandatory workflow

1. **Inspect existing code, present a plan, wait for approval before implementing.** Work in small, reviewable phases.
2. **Never modify protected files** (§5) without explicit approval.
3. **No dependency removals, unrelated cleanup, staging or commits** unless explicitly requested.
4. **Read Next.js local docs** (`node_modules/next/dist/docs/`) before API/architecture changes — mandated by `AGENTS.md`.

### Other conventions

- **All attendance numbers come from `src/lib/attendance.ts`** — never recompute %/skips in UI or AI replies.
- **Follow the design system in §6** — Swiss editorial, Light/Dim/Dark, typography roles, pixel readouts inside panels only, static SS monogram, tokenized status colors.
- **shadcn components as base** for UI primitives.
- **Use project skill `ui-ux-pro-max`** (`D:\SkipSafe\.agent\skills\ui-ux-pro-max`, Python CLI) for design-system/palette/typography/UX/a11y checks when doing design work.
- Tests: `npm test` (or `npm run test:attendance|test:parser|test:ned|test:privacy`); typecheck: `npm run typecheck`; lint: `npm run lint`; build: `npm run build` (Turbopack). Run privacy tests after build. On Windows use `cmd /c` for npm/npx; `rg` unavailable.
- Do not mark roadmap items complete unless independently verified (code + tests/inspection).
- `README.md` is still create-next-app boilerplate — rewrite is a planned task (see TASKS.md), not a knowledge source.

---

## 11. Skills inventory (for future sessions)

| Skill | Location | Use when |
|-------|----------|----------|
| `ui-ux-pro-max` | `D:\SkipSafe\.agent\skills\ui-ux-pro-max` | Design-system, palette, typography, UX/a11y checklists (Python search CLI per its SKILL.md) |
| `find-skills` | `C:\Users\apsac\.agents\skills\find-skills` | Discover/install skills — **never install without asking** |
| `customize-opencode` | built-in | Only for opencode's own config — not SkipSafe app code |

- `ui-ux-pro-max` exists on disk but must be read/invoked manually (not auto-registered).
- No dedicated React/Next.js/testing/accessibility skill packages — per `AGENTS.md`, use the bundled Next.js docs for framework questions.

---

## 12. Current state (2026-11-09)

- **Code:** Phases S, C, 1, 2 (+refinements), 3 (committed in `90b0185`), Phase 3R, Parser Phase P1/P1.1, Phase P2, Phase T (testing/security foundation), the dependency-audit remediation, Milestone 1 (NED connection boundary/UI) and Milestone 2 (real NED attendance retrieval) complete and validated. PDF upload and NED-retrieved PDFs are wired to the dashboard; parsed data is React-state only. The app has no mock data; the dashboard renders only real parsed reports from NED or manual upload (with an empty state when none is loaded). Numbers in `attendance.test.ts` and `courseCardDisplay.test.ts` are synthetic unit-test fixtures only. Real attendance PDFs are never kept in the repo; `test-data/` is git-ignored and holds only a synthetic fixture produced by `npm run generate:fixture`. **The authenticated NED download is implemented against the verified portal contract but has not been smoke-tested with a real student account**; failures are explicit and manual upload remains the fallback. Chatbot is still a stub.
- **Gates:** attendance, parser, NED-boundary and privacy tests pass; TypeScript clean; ESLint clean (0 errors/warnings); production build green (7 routes incl. 4 NED API routes, PDF.js worker emitted); **production dependency audit clean (`npm audit --omit=dev` = 0)** after moving `shadcn` to devDependencies. The full tree still reports 13 dev-only findings (2 low, 11 moderate) in build/lint tooling (`shadcn` CLI, `eslint-config-next`, `typescript-eslint`); no critical/high and no `--force`.
- **CI/security:** GitHub Actions CI, CodeQL and Dependabot configured; secret scanning still requires repository settings; ZAP not run (no staging). NED routes use in-memory sessions; serverless/multi-instance hosting needs a reviewed shared store before live auth.
- **Git:** 5 commits through `90b0185`; all work since (including Phase 3R, parser/upload, Phase T, Milestone 1 and Milestone 2) remains uncommitted and un-staged per instructions.
- **Roadmap:** smoke-test the real NED flow with an authorized account and confirm hosting constraints → Phase 4 (Ask SkipSafe) → Phase 5 (a11y/responsive/motion, retirements/deletions, dep-removal approvals) → Phase D (docs sync incl. README). Details and risks live in `TASKS.md`.
