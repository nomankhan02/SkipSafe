# TASKS.md — SkipSafe living roadmap

Rules:

- Only check a box when the work is **actually done and independently verified** (code + tests/inspection).
- Old plans ≠ completed work. Do not mark planned work as completed.
- No dependency removals, staging or commits unless explicitly requested by the owner.
- Phases require **explicit owner approval** before implementation.
- Design authority and permanent context: `MEMORY.md` (§6 design system, §7 history, §5 protected files).

---

## 1. Completed milestones (verified)

### Foundation (git commits, 2026-10-12/14)

- [x] Project bootstrap: Next.js 16 App Router, TS, Tailwind v4, ESLint — commit `e4f57c3`
- [x] Attendance domain model + pure logic (`src/lib/attendance.ts`) — commit `e4f57c3`
- [x] Attendance tests (`src/lib/attendance.test.ts`) — passing
- [x] PDF parser (`src/lib/parseReport.ts`) + tests — commit `5d50302`; passing
- [x] Synthetic fixture `test-data/sample-attendance.pdf` — generated via `npm run generate:fixture`; `test-data/` is git-ignored (real PDFs are never kept in the repo)
- [x] Dashboard initial scaffold — commit `b1afd54` (mock courses later removed; app has no mock data)
- [x] Legacy exploratory UI (particles, 3D logo, theme toggle) — commit `b59ad2c` (**superseded**, see §4)
- [x] `/` → `/dashboard` redirect
- [x] Initial audit: architecture inventory, calculator/parser verification, lint/build baseline (then 36 errors/9 warnings), dependency + security audit
- [x] `MEMORY.md` + `TASKS.md` created after approval; fully rewritten 2026-10-31 after historical audit

### Phase S — Security upgrades (complete)

- [x] `next` 16.4.0 → **16.4.3**; `react`/`react-dom` 19.3.0 → **19.3.1**; `eslint-config-next` → 16.4.3 (exact pins)
- [x] Advisories verified via npm view + OSV API (16.4.0 had GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r; 16.4.3 clean)
- [x] Validation: tests pass, lint, build green on 16.4.3
- [x] Known remainder: 28 dev-toolchain audit findings (shadcn/eslint/undici trees) — no `npm audit fix --force`

### Phase C — Semester correction (complete, protected-file change by explicit approval)

- [x] `WEEKS_PER_SEMESTER` 16 → **15** in `attendance.ts` with matching test re-baseline (hardSkips: CT-159 10, CT-268 3, EA-244 10, EF-201 7, MT-221 9, MT-331 7; XX-101 edge case → warning)
- [x] Dashboard copy interpolated from constants (no hardcoded 16/75)
- [x] Parser logic and held attendance data preserved; both suites green

### Phase 1 — Design foundation (complete)

- [x] oklch Swiss-editorial token set; `--radius: 0.125rem`
- [x] Light / Dim / Dark themes via `data-theme` (+ `@custom-variant dark`); exactly three
- [x] Bricolage Grotesque + Figtree (+ then Geist Mono) via `next/font/google`
- [x] Theme persistence (localStorage) + pre-hydration `themeInit` script (no flash)
- [x] Status tokens `--status-safe/warning/danger` + `@theme` mappings

### Phase 2 — Editorial chrome (complete, incl. approved refinements)

- [x] `bg-background text-foreground` main; static **SSMonogram** replaces 3D logo in live UI
- [x] Masthead metadata rail (`15 TEACHING WEEKS · 6 COURSES · EXAM LIMIT 75%`)
- [x] Flat 3-column summary readout band (replaces glass stat cards; ParticleNumber removed from use)
- [x] Flattened course cards (later superseded by Phase 3 rows)
- [x] **Cycling theme switch** — Light → Dim → Dark → Light; active swatch = filled + `border-2 border-foreground`; `aria-label` carries state
- [x] Global 260ms color-only theme transitions, guarded by `prefers-reduced-motion: no-preference`
- [x] Popover tokenized for all three themes (later superseded by Phase 3 inline details)
- [x] `v1.2` chip removed, no replacement
- [x] Monogram refined: interlocked/overlapping S's (still individually readable) + layered-carved depth (slab `.25` + carve floor `.16`), no gradients/animation

### Phase 3 — Course interface baseline (complete 2026-10-31, committed in `90b0185`, superseded by 3R)

- [x] Course cards → **Swiss-editorial instrument rows**: header strip (`<button aria-expanded aria-controls>`, multi-open inline expansion, instant toggle) + recessed "screen" area (square, hairline, restrained contrast)
- [x] **`AttendanceScale.tsx`**: SVG `role="progressbar"`, 1 unit = 1%, 75% full-height tick (foreground), pixel-font threshold tag; fill animated 0.65s with reduced-motion guard
- [x] **`PixelStatusSymbol.tsx`**: 7×7 crisp-edge pixel glyphs for safe (check), warning (exclamation), danger (✕), not_started (dash); `currentColor`; always paired with text label
- [x] **Silkscreen** pixel font added (`next/font/google`, weights 400/700, ~3.5KB subset files) as `font-pixel` — used **only** for panel numerals (percent `text-4xl/5xl`, SAFE/LIMIT counters `text-2xl`, scale tags `text-sm`, `[+]/[-]` indicator)
- [x] Typography correction: **Geist Mono loader removed**; `--font-mono` → system stack (code/kbd only); all ordinary labels/metadata → **Figtree**; summary-band display numbers → **Bricolage Grotesque**
- [x] MorphingPopover retired from the dashboard: all popover content preserved as inline expanded details (theory/practical breakdown + planned, eligibility skip rows, danger guidance, not-started note); popover dismissal sentence removed; `morphing-popover.tsx` file kept on disk (Phase 5)
- [x] Validation: both suites pass; lint 4e/3w (Phase 5 files only); build green; output checks verified (no popover markup, aria-expanded/controls present, font-pixel + Silkscreen CSS present, progressbar label includes thresholds)

### Phase 3R — Responsive compact course grid & Swiss editorial refinement (complete 2026-10-31)

- [x] Replaced single-column stacked accordion rows with responsive compact course-box grid: `grid-cols-1 items-start sm:grid-cols-2 lg:grid-cols-3`
- [x] Simplified attendance allowance: 80% safety cushion dropped; elevated single clear metric **"Skips left"** based on the 75% exam eligibility threshold (`analysis.hardSkips`)
- [x] Fixed grid expansion stretching: added `items-start` so expanding one card does not stretch adjacent cards in the same grid row
- [x] Implemented smooth drawer open/close animation via `AnimatePresence` + height/opacity animation with `[0.16, 1, 0.3, 1]` cubic-bezier easing, fully guarded by `useReducedMotion`
- [x] Preserved independent multi-open behavior and keyboard accessibility (`aria-expanded`, `aria-controls`)
- [x] Refined course code/name typography: boosted prominence using Bricolage Grotesque bold tracking-wider treatment across collapsed card headers (`text-lg font-bold font-bricolage`), expanded details (`text-sm font-bold font-bricolage`), and summary band (`text-lg font-bold font-bricolage`), maintaining clear visual balance with the skips left figure
- [x] Elevated **Skips Left** to the headline primary collapsed readout in Bricolage Grotesque 40px/44px, tabular-nums, bold (`text-[40px] sm:text-[44px] font-bold tabular-nums`)
- [x] Relocated attendance percentage to the expanded view in Bricolage Grotesque 28px/32px, tabular-nums, bold (`text-[28px] sm:text-[32px] font-bold tabular-nums`) alongside simplified `AttendanceScale` (75% limit tick) and class counts
- [x] Superseded Silkscreen pixel font in favor of minimal Swiss-editorial display numbers (Bricolage Grotesque + tabular numerals) across course skips, percentages, and overview band
- [x] Redesigned status symbols from arcade pixel glyphs to **`StatusSymbol.tsx`** restrained, theme-aware geometric stroke marks:
  - Eligible / skips remaining (`safe` — polyline check)
  - At limit / 0 skips left (`limit_reached` — geometric diamond)
  - Danger / ineligible (`danger` — diagonal cross)
  - Not started (`not_started` — dashed line)
- [x] Ensured collapsed course cards and expanded details feel like one cohesive, quiet Swiss editorial instrument
- [x] Preserved pure logic invariants, 15-week model, dynamic course data flow, and no modifications to protected files
- [x] Validation: test suites pass, lint baseline clean (4e/3w in retired files), production build verified green

**Explicitly NOT completed at that time:** PDF upload wiring (completed later in Phase P2); chatbot implementation; file deletions/dependency removals; README rewrite; CI; deployment.

### Parser Phase P1 — Robust report parsing (complete 2026-11, uncommitted)

- [x] Flexible header tokens and dynamic column anchors with validated defaults
- [x] Multiple credit formats; explicit/defaulted/missing count handling
- [x] Present ≤ held validation; unrecognised values kept as skipped rows
- [x] Printed-percentage extraction and computed-vs-printed warnings
- [x] Multi-page support; page-aware row keys prevent cross-page merging
- [x] Verified replacement PDF fixture (gitignored) and preserved old regression-test intent
- [x] Existing six-course parse and both test suites pass

### Parser Phase P1.1 — Robust row classification (complete 2026-11-03, uncommitted)

- [x] High-confidence metadata classification: student info, academic year, dates, department/faculty, table headers, page headers, page furniture, aggregate/summary rows, notes, copyright/footer
- [x] No metadata guessing from capitalization, word count or university-specific course-code shape
- [x] Ambiguous and malformed rows returned as `incomplete` with clear reasons; silent-discard branch removed
- [x] `SkippedRow`, `MetadataKind`, `RowInput` and pure `classifyRow` exported for tests
- [x] Five known metadata rows in current PDF classified as metadata, not incomplete errors
- [x] Six valid courses preserved; all parser capabilities intact
- [x] Tests added for metadata, ambiguous/malformed rows, course preservation and attendance integration

### Phase P2 — PDF upload integration (complete 2026-11-03, uncommitted)

- [x] Client PDF upload control with file-type/size validation
- [x] Browser PDF.js worker configured from a bundled static asset
- [x] Local parsing: `parseAttendanceReport → Course[] → attendance.ts → dashboard`
- [x] Uploaded courses rendered through existing `analyzeCourse`/`getAttendanceSummary`; no duplicated math
- [x] Parser warnings and incomplete rows shown; metadata summarized neutrally
- [x] Replace and clear/reset flows; failed replacement keeps previous valid report
- [x] No-report empty state replaces mock data; app has no mock data
- [x] Uploaded courses kept in React state only (no localStorage/IndexedDB/backend/accounts)
- [x] No PDF bytes or parsed attendance data sent to any external API
- [x] Validation: attendance tests, parser tests, lint baseline unchanged, production build green; browser worker asset emitted

### Phase T — Automated testing & security foundation (complete 2026-11-07, uncommitted)

- [x] `npm test` plus `test:attendance`, `test:parser`, `test:privacy`, `typecheck` scripts
- [x] Privacy regression suite (`src/lib/privacy.test.ts`) covering storage, logging, network/analytics, backend/DB absence, parser output shape, cleanup, env secrets and client-bundle leakage
- [x] Synthetic non-personal PDF fixture generator (`npm run generate:fixture`) so parser tests run without committing real student reports (real PDFs are never kept in the repo; `test-data/` is git-ignored)
- [x] GitHub Actions CI: install, typecheck, lint, attendance/parser/privacy tests, production build, dependency audit
- [x] CodeQL workflow and Dependabot (npm + GitHub Actions)
- [x] Baseline security headers + CSP in `next.config.ts`; `poweredByHeader` disabled
- [x] ESLint baseline cleaned from 4 errors/3 warnings to 0/0 (retired files only; no live UI change)
- [x] Non-breaking `npm audit fix`: production findings reduced from 13 (1 low/6 moderate/6 high) to 6 (2 low/4 moderate), remaining in the shadcn CLI tree
- [x] `shadcn` moved to devDependencies (2026-11-08): production audit **0**; full-tree 13 dev-only findings documented; no breaking upgrade or `--force`
- [x] ZAP evaluated; no staging environment, so no dynamic scan was run (documented instead)
- [x] Docs updated (AGENTS/MEMORY/TASKS/rules)

### Milestone 1 — NED connection foundation (complete 2026-11-08, uncommitted)

- [x] Responsive NED connection panel matching the Swiss-editorial dashboard: student ID, password, CAPTCHA image area, CAPTCHA answer, refresh CAPTCHA, connect and disconnect
- [x] Explicit states: idle, loading CAPTCHA, ready, connecting, connected, invalid request/credentials, CAPTCHA failure, portal unavailable, timeout, session expired, rate limit and integration unavailable
- [x] Manual CAPTCHA only — no bypass, OCR, automation or third-party CAPTCHA service
- [x] Typed shared contracts; server-only fail-closed `NedPortalAdapter`; no NED endpoint invented or contacted
- [x] Three reviewed route handlers: `POST /api/ned/session/challenge`, `POST /api/ned/session/connect`, `DELETE /api/ned/session`
- [x] Per-session in-memory store: 256-bit random opaque IDs, 5-minute TTL, isolation, capacity limit, no credential/CAPTCHA fields
- [x] Session cookie: `HttpOnly`, `SameSite=Strict`, `Path=/api/ned`, `Secure` on HTTPS; session ID never in JSON or URL
- [x] Request hardening: same-origin check, JSON content type, 8 KiB body limit, malformed JSON rejection, 10-second adapter timeout
- [x] Credentials and CAPTCHA answer cleared after every connect attempt; pagehide best-effort disconnect; explicit disconnect
- [x] `test:ned` suite for validation, states, cookies, isolation, TTL, credential non-persistence, error mapping, timeout, request hardening and fail-closed adapter
- [x] Privacy tests extended with an exact route/fetch allowlist, client field-clearing checks, server-only session-record checks and client-bundle server-internal scan
- [x] CI updated to run `npm run test:ned`
- [x] Validation: typecheck, lint, attendance, parser, NED and privacy tests pass; production build green with 3 dynamic NED routes

### Milestone 2 — Real NED attendance retrieval (complete 2026-11-09, uncommitted; real-account smoke test pending)

- [x] Live undergraduate adapter for the verified public contract: `/captchaportal` CAPTCHA + `JSESSIONID`, `POST /index.jsp` login fields, `/undergrad/jsp_to_pdf_servlet?p=<studentId>_attendancecard`
- [x] `POST /api/ned/session/attendance` returns the PDF in memory to the browser; no storage or logging
- [x] PDF validation: content type, size limit and `%PDF-` magic; HTML/login pages never treated as reports
- [x] Session expiry mapping (401/403, login redirect, unauthenticated HTML) clears the session; transient errors keep it for retry
- [x] Auto-retrieve after connect, retry control, and manual PDF upload fallback; retrieved PDF feeds the existing browser parser
- [x] Adapter/handler tests: endpoint contract, cookies, card ID, rejected login, HTML-as-PDF, connected-session requirement, expiry and invalid PDF
- [x] Privacy route allowlist updated for the new route
- [x] Validation: typecheck, lint, attendance, parser, NED, build and privacy suites pass
- [ ] **Smoke-test the authenticated download with an authorized real student account** (blocked: no credentials provided)

**Explicitly NOT done:** verified real-account end-to-end confirmation; shared/sticky session storage for serverless; hosting log-retention audit; staging/ZAP.

---

## 2. Current state (verified 2026-11-09)

- [x] UI supports local PDF upload and NED retrieval; parser wired into dashboard; app has no mock data (empty state when no report loaded)
- [x] Uploaded/retrieved report data exists in React state only (cleared on refresh)
- [x] NED connection UI and real undergraduate attendance retrieval implemented; **authenticated download not yet smoke-tested with a real account**
- [x] Portal contract verified against the public login/CAPTCHA/attendance endpoints; no endpoint, field or URL invented
- [x] Retrieved PDF transits the server in memory only; never stored or logged
- [x] No env secrets in use; no database, analytics or monitoring SDKs
- [x] Ask SkipSafe = stub button only
- [x] Tests run via `npm test` (attendance + parser + NED + privacy) and in GitHub Actions CI
- [x] Lint baseline: **0 errors / 0 warnings** (retired files cleaned in Phase T; live code clean)
- [x] Build: `next build` (Turbopack) green; 7 routes including 4 dynamic NED API routes; PDF.js worker emitted
- [x] Privacy suite passes, including post-build client-bundle scan
- [x] Production `npm audit --omit=dev`: **0 findings** after moving `shadcn` to devDependencies (2026-11-08); full-tree dev-only findings documented separately; no critical/high; no `--force`
- [x] Git: 5 commits (through `90b0185`); **all work since remains uncommitted/un-staged per instructions**
- [x] `README.md` still create-next-app boilerplate
- [x] Versioning: `v1.2` UI chip removed; `package.json` version still `0.1.0` — release versioning undecided

---

## 3. Known technical debt

- [ ] **Retirements (Phase 5, needs approval):** delete `Interactive3DLogo.tsx`, `BackgroundParticleCanvas.tsx`, `CardParticleCanvas.tsx`, `ParticleNumber.tsx`, `ui/morphing-popover.tsx` — files exist but are unused by live pages
- [ ] **Dependency removals (separate explicit approval):** `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `lenis` are installed but unused by live UI (also evaluate `@base-ui/react`, `cn`, `motion` vs `framer-motion` overlap during that pass). `shadcn` is no longer a runtime dependency (moved to dev in 2026-11-08).
- [x] **Lint debt resolved (Phase T):** 0 errors / 0 warnings; retired files received minimal `prefer-const`/unused-var fixes and scoped lint suppressions
- [ ] Unused shadcn primitives in `src/components/ui/` (input, label, toggle, card, badge — card/badge no longer imported by dashboard) — tidy in Phase 5
- [ ] `.agent/skills/ui-ux-pro-max/scripts/__pycache__/` committed in initial commit — cleanup candidate (Phase D)
- [x] `npm test` script and GitHub Actions CI added in Phase T
- [x] **Dependency audit remediation (2026-11-08):** `shadcn` moved from `dependencies` to `devDependencies` (build-time CSS import + CLI only), lockfile synced, production audit now **0**. Full-tree audit retains 13 dev-only findings (2 low, 11 moderate) in `shadcn`/`eslint-config-next`/`typescript-eslint`; not shipped runtime code. No `--force`.
- [ ] **Secret scanning:** enable GitHub native secret scanning + push protection in repository settings
- [ ] README boilerplate; docs partially synced (MEMORY/TASKS rewritten 2026-10-31; README pending)

---

## 4. Phase 4 — Ask SkipSafe chatbot (awaiting explicit approval)

Approved direction so far (scope only — no implementation yet):

- [ ] Entry copy exactly: "Schedule changed? Ask SkipSafe." (already present in masthead)
- [ ] Five exact suggested questions (to be specified at Phase 4 planning)
- [ ] Answers computed **only** from `attendance.ts` outputs of loaded report — never invented numbers (app has no mock data)
- [ ] Honest placeholder state until real answers ship
- [ ] Optional helper exports from `attendance.ts` (e.g., Q1/Q3 answer builders) — **separate protected-file approval required**
- [ ] If LLM involved: server-side key, no `NEXT_PUBLIC_` secrets, no PDF exfiltration, retention policy approved (MEMORY §2 policy)
- [ ] Design: follow MEMORY §6 (Swiss editorial; popover/floating panel would need tokenized theming + reduced-motion care)

---

## 5. Phase 5 — Accessibility, responsive, motion, lint cleanup (awaiting approval)

- [ ] Accessibility pass: focus states, contrast (4.5:1), keyboard paths for expansion controls, screen-reader spot checks
- [ ] Responsive verification: 375 / 768 / 1024 / 1440 — no horizontal scroll; Silkscreen readouts stay within panels
- [ ] Motion audit: every framer transition guarded by `useReducedMotion` / media query
- [ ] Fix or delete retired lint offenders (deletions preferred — see §3, needs approval)
- [ ] Dependency removals as approved in §3
- [ ] Regression gate: both suites + lint + build

---

## 6. Phase D — Documentation sync & cleanup (in progress)

- [x] MEMORY.md historical audit + rewrite (2026-10-31) — Phases S/C/1/2/2R/3 recorded with evidence
- [x] TASKS.md rewrite (this file)
- [x] `.agents/rules/skipsafe.md` updated to current architecture (themes/typography/protected files)
- [ ] README rewrite: what SkipSafe is, run/test instructions, privacy stance, design summary
- [ ] After first commit of phase work: verify docs still match; changelog entries kept
- [ ] Release versioning decision (drop or reinstate a version indicator; bump `package.json`)

---

## 7. Product features (not started — need product decisions)

### PDF upload (MVP data path) — complete in Phase P2

- [x] Client-only upload control accepting PDF
- [x] Configure pdfjs worker in the browser (bundled static worker asset)
- [x] `parseAttendanceReport` → active dashboard state (mock data removed; empty state when no report loaded)
- [x] Surface `ParseWarning[]` and classified incomplete rows in UI without logging content
- [x] Error states: wrong file type, empty file, oversized file, malformed PDF, unsupported layout
- [x] Clear/reset report action (resets to empty state; app has no mock data); failed replacement preserves previous report
- [x] Metadata rows summarized neutrally, not shown as course errors

### Local persistence (deferred by Phase P2 requirement)

- [ ] Choose storage (memory / localStorage / IndexedDB) for parsed courses — **intentionally React state only for now**
- [ ] Schema versioning + clear-data control; confirm no server sync by default

### University portal (retrieval implemented 2026-11-09; smoke test pending)

- [x] Product decision: manual CAPTCHA + typed credentials, with manual PDF upload fallback
- [x] Privacy/threat-model note in MEMORY before code
- [x] No password storage/logging; manual CAPTCHA only
- [x] Verified portal login/CAPTCHA/attendance contract; adapter retrieves the undergraduate attendance PDF through the session
- [ ] Confirm end-to-end retrieval with an authorized real student account

### Nice-to-have (not started)

- [ ] Per-course planned-hours overrides UI (`thPlanned` / `prPlanned`)
- [ ] Week/semester picker
- [ ] Export summary (no raw PDF) — privacy reviewed
- [ ] PWA/offline considerations

---

## 8. Testing and QA (outstanding)

- [x] Attendance + parser suites exist and pass (re-verified 2026-11-07)
- [x] Parser→attendance integration test on the current PDF (6 courses, analysis values asserted)
- [x] Upload code path, replace/error/clear state transitions and worker asset build verified by inspection/build (no browser automation installed)
- [x] `package.json` `test` script running attendance + parser + privacy suites; `typecheck` script
- [x] CI (GitHub Actions): typecheck + lint + tests + build + dependency audit on every push/PR
- [x] Privacy regression suite (source + client-bundle scan)
- [x] Parser fixture strategy: synthetic non-personal PDF generated via `npm run generate:fixture` (real attendance PDFs are never kept in the repo; `test-data/` is git-ignored)
- [ ] Component/UI tests (no runner installed)
- [ ] E2E browser test: upload synthetic fixture PDF → dashboard shows 6 courses (manual verification recommended)
- [ ] Accessibility audit of instrument-panel dashboard (Phase 5)
- [ ] Dynamic security scan (OWASP ZAP) — requires staging + authorization
- [x] Backend credential/session cleanup tests: expiry, disconnect, invalid PDF and HTML-as-PDF cases covered with fake adapters
- [ ] Real-account smoke test of NED retrieval (needs authorized credentials)

---

## 9. Deployment and release preparation

- [ ] Decide host (Vercel assumed by boilerplate — unconfirmed)
- [ ] Production metadata / favicon / OG polish
- [x] Baseline security headers + CSP added in `next.config.ts` (CSP uses `'unsafe-inline'` for Next's inline scripts; tighten with a nonce in a later phase)
- [ ] Re-review CSP/headers once chatbot or external APIs exist (local Next docs: content-security-policy, data-security)
- [ ] Enable GitHub native secret scanning + push protection (repository setting)
- [ ] OWASP ZAP baseline scan once a staging URL exists (manual, unauthenticated, authorized; never against the NED portal or production). Draft trigger: `workflow_dispatch` with a required staging URL input, `zaproxy/action-baseline`, report uploaded as an artifact, `fail_action: false` initially.
- [ ] Audit hosting-provider request logs, tracing and crash/error monitoring retention before any backend credential flow ships
- [ ] Env var inventory: server-side secrets only; names without values
- [ ] Confirm real attendance PDFs are never kept in the repo and `test-data/` is git-ignored
- [ ] Error boundaries + empty states for production
- [ ] README rewrite (Phase D)
- [ ] Version/tag first public release; versioning decision per §2
- [ ] Post-release monitoring that does **not** log student data

---

## Dependency sketch

```text
Phase 4 chatbot (needs approval + possibly protected-file helpers)
        │
Phase 5 cleanup (needs approval for deletions + dependency removals)
        │
Phase D: README + post-commit doc sync ──►
        │
PDF upload wiring ──► real-data dashboard (done in Phase P2)
        │
        └──► E2E browser test (pending runner/manual verification)
        │
Portal flow (only after explicit product/privacy approval)
```

Every phase starts with: inspect → plan → **explicit approval** → implement → diff → gates → stop.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-10-31 | Initial audit draft (tests verified passing) |
| 2026-10-31 | TARGET vs CURRENT design split; semester discrepancy preserved |
| 2026-10-31 | MEMORY.md + TASKS.md created after approval |
| 2026-10-31 | Phase S (next 16.4.3, react 19.3.1, eslint-config-next 16.4.3; OSV verified; 28 dev findings accepted) |
| 2026-10-31 | Phase C (WEEKS_PER_SEMESTER 16→15 with approved test re-baseline; copy interpolated) |
| 2026-10-31 | Phase 1 (oklch tokens, Light/Dim/Dark via data-theme, Bricolage/Figtree, radius 2px, anti-flash themeInit) |
| 2026-10-31 | Phase 2 (SSMonogram, readout band, flat chrome, status tokens; card flattening) |
| 2026-10-31 | Phase 2 refinements (cycling theme switch, reduced-motion color transitions, popover tokens, monogram interlock/depth, v1.2 removed) |
| 2026-10-31 | Phase 3 (instrument rows, AttendanceScale, PixelStatusSymbol, Silkscreen `font-pixel`, Geist Mono removed, MorphingPopover retired from dashboard, Figtree typography correction) |
| 2026-10-31 | Historical documentation audit: MEMORY.md + TASKS.md fully rewritten; `.agents/rules/skipsafe.md` updated; AGENTS.md untouched (Next.js-generated only) |
| 2026-11-03 | Parser Phase P1.1: metadata/incomplete classification, exported `SkippedRow`/`classifyRow`, silent-discard fix, page-aware rows, metadata/ambiguous/malformed/integration tests |
| 2026-11-03 | Phase P2: browser PDF upload → parser → attendance → dashboard; bundled worker; warnings/incomplete display; replace/clear; React state only (mock fallback later superseded) |
| 2026-11-03 | Docs updated for P1/P1.1/P2; privacy and current-state sections synced |
| 2026-11-07 | Phase T: npm test/typecheck scripts, privacy regression suite, synthetic CI fixture, GitHub Actions CI, CodeQL, Dependabot, security headers, lint cleanup, audit triage, ZAP evaluated (not run) |
| 2026-11-08 | Dependency audit remediation: `shadcn` → devDependencies (no breaking change), production audit 0; full-tree dev-only findings remain documented; full test/build/privacy gate green |
| 2026-11-09 | Milestone 2: real NED undergraduate attendance-PDF retrieval via authenticated session; new attendance route; PDF validation; auto-retrieve/retry; adapter/handler tests; docs synced (real-account smoke test pending) |
