# MEMORY.md — SkipSafe permanent project knowledge

Source of truth for a new AI session or model.

**`AGENTS.md` is Next.js-generated tooling guidance — do not overwrite, rewrite, or strip its block.**
**`.agents/rules/skipsafe.md` is an always-on project rule file — keep it; this file supplements it, it does not replace it.**
**`TASKS.md` is the operational roadmap — keep MEMORY.md and TASKS.md in agreement.**

> Documentation status: fully rewritten 2026-10-31 after a historical audit of git history (4 commits, all pre-redesign) and the uncommitted work of Phases S/C/1/2/2R/3. Claims below are verified against code, builds and test runs unless explicitly marked unverified.

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
- Status vocabulary: `not_started` | `safe` | `warning` | `danger`.
- **Safe skips** (stay ≥80%) and **hard skips** (stay ≥75%) assuming all remaining classes are attended.
- Semester summary: courses at risk, lowest course, safest course.
- PDF parser for NED "Course-Wise Attendance Analysis" reports (`parseAttendanceReport`) — built and tested, **not yet wired into the UI**.
- Dashboard rendering `MOCK_COURSES` through `analyzeCourse`/`getAttendanceSummary` (no math in UI).
- Swiss-editorial dashboard: masthead + SS monogram, summary readout band, instrument-panel course rows with inline expandable details, `AttendanceScale` SVG (75/80 ticks), pixel status symbols, Light/Dim/Dark themes with cycling switch and pre-hydration theme script.
- Ask SkipSafe header button exists; handler is still a stub (`onClick={() => {}}`).

### Attendance tracking workflow (intended end-state)

1. Student obtains attendance data (today: mock; planned: PDF upload and/or portal).
2. Parser/`Course[]` feeds `analyzeAll` / `getAttendanceSummary`.
3. Dashboard shows status, %, safe/hard skips.
4. Student uses skip guidance before missing class.

### University portal & manual CAPTCHA (planned, not built)

- **Not implemented.** No login, no CAPTCHA handling, no portal access in the repo.
- Product direction: if portal access is added, CAPTCHA stays **manual/human**; never store portal passwords; never log credentials or request bodies.

### PDF attendance report processing (built, tested)

- `src/lib/parseReport.ts` — position-based pdfjs parsing (column x-buckets, y rounded to 4pt rows).
- Detects "Course Code" header; rejects wrong layouts with clear errors.
- Sanity-checks computed % vs printed % (warns if delta > 0.1).
- **Never logs PDF bytes or extracted text.** Returns `Course[]` + `warnings[]`.
- Sample: `test-data/sample-attendance.pdf` (gitignored — never commit real student PDFs).

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

### Stack & versions (`package.json`, verified 2026-10-31)

| Area | Choice |
|------|--------|
| Framework | `next` **16.4.3** (exact pin; was 16.4.0 — upgraded in Phase S) |
| React | **19.3.1** / `react-dom` 19.3.1 (exact pins; was 19.3.0) |
| Lint config | `eslint-config-next` **16.4.3** (exact pin) |
| Language | TypeScript ~5.9 |
| Styling | Tailwind CSS v4 + `@tailwindcss/turbopack`, `tw-animate-css`, `shadcn/tailwind.css`; oklch tokens |
| Fonts | `next/font/google`: Bricolage Grotesque (headings), Figtree (body), **Silkscreen** (pixel numerals, panel readouts only). Geist Mono loader **removed** in Phase 3; `--font-mono` = system stack for `code`/`kbd`. |
| Components | shadcn-style primitives in `src/components/ui/` (button, card, badge, input, label, toggle — **morphing-popover retired from use**, see §8) |
| Animation | `framer-motion`/`motion` 14.x (entrance fades, scale-fill; all reduced-motion guarded) |
| 3D/canvas (retired) | `three`, `@react-three/fiber`, `@react-three/drei`, `lenis` still **installed** but unused by any live UI — removal is a Phase 5 decision requiring explicit approval |
| Icons | `lucide-react` (no emoji); pixel status glyphs are hand-built SVG |
| PDF | `pdfjs-dist` (devDependency; dynamic import in parser) |
| Tests | Plain Node assert via `npx tsx` (no Jest/Vitest/CI yet) |

`next.config.ts`: `cacheComponents: true`, `partialPrefetching: true`, Turbopack CSS rule for Tailwind.

### Project structure

```text
AGENTS.md                 # Next.js-generated — preserve untouched
.agent/skills/            # Project skill: ui-ux-pro-max (singular ".agent")
.agents/rules/skipsafe.md # Always-on rules — keep; update only when architecture changes
MEMORY.md / TASKS.md      # This file + operational roadmap
src/
  app/
    layout.tsx            # 3 next/font loaders + themeInit inline script + data-theme="light"
    page.tsx              # redirect → /dashboard
    dashboard/page.tsx    # Main UI (mock data, instrument panels)
    globals.css           # Tailwind v4 + oklch tokens + 3 themes + status tokens + transition base
  components/
    SSMonogram.tsx        # Static carved/interlocked SS monogram (currentColor)
    AttendanceScale.tsx   # SVG scale with 75/80 threshold ticks (client, framer fill)
    PixelStatusSymbol.tsx # 7×7 pixel-art status glyphs (safe/warning/danger/not_started)
    BackgroundParticleCanvas.tsx / CardParticleCanvas.tsx /
    ParticleNumber.tsx / Interactive3DLogo.tsx
                          # RETIRED: on disk, not imported by any live page (Phase 5 deletions)
    ui/                   # shadcn primitives (+ morphing-popover.tsx, retired from use)
  lib/
    attendance.ts         # PURE logic — PROTECTED
    attendance.test.ts    # PROTECTED
    parseReport.ts        # PDF parser — PROTECTED
    parseReport.test.ts   # PROTECTED
    mockCourses.ts        # dashboard fixtures (6 courses)
    utils.ts, try.ts
test-data/sample-attendance.pdf  # gitignored
```

### Key component responsibilities

- **`attendance.ts`:** `currentPercent`, `skipsLeft`, `analyzeCourse`, `analyzeAll`, `getAttendanceSummary`; constants `WEEKS_PER_SEMESTER`, `HARD_LIMIT`, `SAFE_LIMIT`; types `Course`, `Status`, `CourseResult`, `SummaryReport`.
- **`parseReport.ts`:** `parseAttendanceReport(pdfData) → { courses, warnings }`.
- **`dashboard/page.tsx`:** presentation only; maps `MOCK_COURSES` through `analyzeCourse`; theme store (useSyncExternalStore + MutationObserver); never reimplements math.
- **`AttendanceScale.tsx`:** `role="progressbar"` SVG, 1 unit = 1% (`viewBox 0 0 100 6`), ticks at HARD_LIMIT/SAFE_LIMIT, reduced-motion-guarded fill.
- **`PixelStatusSymbol.tsx`:** `fill="currentColor"` + `shape-rendering="crispEdges"`, always paired with a visible text label.

### How the app currently works

1. `/` redirects to `/dashboard`.
2. `layout.tsx` runs a validated localStorage `themeInit` script pre-hydration; `<html data-theme="light" suppressHydrationWarning>`.
3. Dashboard maps `MOCK_COURSES` through `analyzeCourse` + `getAttendanceSummary`.
4. Renders masthead, summary readout band, instrument-panel course rows (expandable inline details), footer disclaimer.
5. PDF parser + attendance tests run via `npx tsx` but are **not wired into the UI**.

---

## 4. Attendance rules and assumptions

| Rule | Value / behavior | Where |
|------|------------------|-------|
| Exam eligibility (hard) | **75%** per course | `HARD_LIMIT` |
| Safe cushion (product) | **80%**, labeled as cushion, not law | `SAFE_LIMIT` |
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
| `src/lib/attendance.test.ts` | Expected values derive from a real portal report (12-OCT-26); do not loosen asserts |
| `src/lib/parseReport.ts` | Keep privacy (no logging of PDF); position-based parsing is intentional |
| `src/lib/parseReport.test.ts` | Uses sample PDF; keep byte privacy |
| `Course` type, `Status` vocabulary, `getAttendanceSummary` | Stable; UI depends on them |
| `mockCourses.ts` | Fixture (CT-159, CT-268, EA-244, EF-201, MT-221, MT-331) — replaceable by real data |

**Regression gate after any change:**

```bash
npx tsx src/lib/attendance.test.ts
npx tsx src/lib/parseReport.test.ts
npm run lint
npm run build
```

---

## 6. Design system (authoritative — current, implemented)

The dashboard **has been redesigned** to the target Swiss-editorial/instrument-panel direction (Phases 1–3). What follows is the live system; do not resurrect the legacy style.

### 6a. Visual direction

- **Swiss editorial + architectural minimalism + retro instrument-panel readouts** inside course panels.
- **Light foundation**, hairline borders, sharp geometry (`--radius: 0.125rem`), flat surfaces.
- **Forbidden:** glassmorphism, neon, gradients, glossy effects, heavy shadows, generic SaaS card grids, bulky rounded corners, rotating 3D, particles, WebGL.
- Information design like a precision instrument: dense but legible, clear rules and dividers, restrained accents used only for meaning.
- Course panels deliberately evoke a **minimalist retro pixel-game screen** — square geometry, thin borders, restrained contrast — but only inside those panels; the rest of the site stays Swiss editorial.

### 6b. Typography (four roles — Phase 3 correction, supersedes the old mono-for-labels rule)

| Role | Font | Usage rules |
|------|------|-------------|
| Headings | **Bricolage Grotesque** | h1–h6 via base layer; also summary-band display numbers |
| Body + all ordinary text | **Figtree** | labels, descriptions, metadata, status text, panel subcopy — **never use monospace for ordinary small text** |
| Numeric readouts in course panels | **Silkscreen** (`font-pixel`) | percent, SAFE/LIMIT counters, scale tags, `[+]/[-]` indicator — **inside course panels only** |
| `code`/`kbd` only | system mono (`--font-mono`) | Geist Mono webfont was removed in Phase 3 |

Geist Mono as ordinary UI typography is **banned** — it produced the rejected "AI-typewriter" look. Adding any new font requires approval.

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

Git contains **4 commits, all predating the redesign** (all work since 2026-10-14 is uncommitted):

| Commit | Date | Content |
|--------|------|---------|
| `e4f57c3` | 2026-10-12 | Bootstrap (Next 16.4.0, TS, Tailwind v4), attendance logic + tests, ui-ux-pro-max skill |
| `5d50302` | 2026-10-12 | PDF parser + tests |
| `b1afd54` | 2026-10-12 | Dashboard (mock data) |
| `b59ad2c` | 2026-10-14 | Legacy UI WIP: particles, theme toggle, 3D logo |

Approved phased work (all complete unless noted; uncommitted as of this writing):

1. **Initial audit** — architecture inventory, calculator/parser verification (both test suites green), lint/build baseline (36 errors/9 warnings at the time), dependency audit, security findings, MEMORY/TASKS created after approval.
2. **Phase S (security)** — `next` 16.4.0 → **16.4.3**, `react`/`react-dom` 19.3.0 → **19.3.1**, `eslint-config-next` → 16.4.3 (exact pins preserved). Verified via npm view + OSV API (16.4.0 advisories: GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr, GHSA-p3m5-59mp-jv5r; 16.4.3 clean). Remaining 28 dev-toolchain findings (shadcn/eslint/undici trees) — no `npm audit fix --force`.
3. **Phase C (semester correction)** — `WEEKS_PER_SEMESTER` 16 → **15** in protected code with explicit approval; tests re-based (hardSkips: CT-159 10, CT-268 3, EA-244 10, EF-201 7, MT-221 9, MT-331 7; XX-101 edge case → `th("XX-101", 4, 45, 60)`); dashboard copy interpolated from constants. Parser + held data untouched.
4. **Phase 1 (design foundation)** — oklch Swiss-editorial tokens for 3 themes via `data-theme`; `--radius: 0.125rem`; Bricolage/Figtree/(then)Geist Mono via `next/font`; base-layer heading font + tabular-nums rule; `themeInit` anti-flash script.
5. **Phase 2 (editorial chrome)** — `bg-background` main; masthead with SSMonogram + metadata rail; flat 3-column summary readout band (replacing glass stat cards, ParticleNumber removed from use); flattened course cards; status tokens replacing neon classes; flat footer.
6. **Phase 2 refinements** — single cycling theme switch (filled active swatch + strong border); global reduced-motion-guarded color transitions; popover tokenized (all three themes); `v1.2` chip removed; monogram interlock + layered-carved depth.
7. **Phase 3 (course interface, 2026-10-31)** — course cards → **Swiss-editorial instrument rows** (header strip button with `aria-expanded`/`aria-controls` + recessed "screen" area); **`AttendanceScale` SVG** (progressbar semantics, 75/80 ticks, pixel threshold tags); **`PixelStatusSymbol`** 7×7 crisp-edge glyphs; **Silkscreen** integrated as `font-pixel` (panel numerals only); Geist Mono loader removed and ordinary labels switched to Figtree; MorphingPopover retired from the dashboard (inline expansion, instant, multi-open); all popover content preserved inline. Validation: both suites pass, lint 4e/3w (Phase 5 debt only), build green.

**Superseded decisions (kept for history, do not restore):** 16-week constant; dark-only slate/glassmorphism UI; 3D rotating logo; particle canvases/ParticleNumber in live UI; Geist Mono for ordinary labels; three-button segmented theme control; card-grid course layout; popover-based details; `v1.2` version chip; `.dark` class toggling.

---

## 8. Retired-but-on-disk assets (Phase 5 candidates — do not resurrect, do not delete without approval)

- `Interactive3DLogo.tsx`, `BackgroundParticleCanvas.tsx`, `CardParticleCanvas.tsx`, `ParticleNumber.tsx` — not imported by any live page.
- `ui/morphing-popover.tsx` — no longer imported by the dashboard; contains the 2 known lint errors (Phase 5).
- npm deps now unused by live UI: `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `lenis` — **removal requires explicit approval** (no dependency removals happened in Phases 1–3).
- Known lint baseline: **4 errors / 3 warnings**, all in the above retired files (`morphing-popover.tsx`, `BackgroundParticleCanvas.tsx`, `Interactive3DLogo.tsx`, `ParticleNumber.tsx`). Live dashboard/components are lint-clean.

---

## 9. Privacy and security

1. **No password storage or logging** — ever (portal or otherwise).
2. **Attendance data stays local in the browser** (mock today; future: memory/localStorage/IndexedDB — not a backend DB by default).
3. **API keys remain server-side** (route handlers / server actions only).
4. **No `NEXT_PUBLIC_` exposure of secrets.**
5. **Never commit** `.env*`, real student PDFs, or personal data (`.gitignore` covers `.env*` and `test-data/`).
6. **Never log** request bodies, PDF binaries, or extracted PDF text.
7. CAPTCHA (if portal flow exists) stays manual — no bypass tooling.
8. Chatbot (when built) must not send student data to third parties without explicit design approval.

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
- Tests: `npx tsx <file>.test.ts`; lint: `npm run lint`; build: `npm run build` (Turbopack). On Windows use `cmd /c` for npx; `rg` unavailable.
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

## 12. Current state (2026-10-31)

- **Code:** Phases S, C, 1, 2 (+refinements) and 3 complete and validated. Parser still not wired to UI; chatbot stub only.
- **Gates:** attendance tests pass; parser tests pass; lint 4e/3w (retired files only); `next build` green (Next 16.4.3 Turbopack, 5 static pages).
- **Git:** 4 commits as in §7; **everything since is uncommitted and un-staged** (per user instruction — no staging/commits without explicit request).
- **Roadmap:** Phase 4 (Ask SkipSafe) → Phase 5 (a11y/responsive/motion/lint cleanup + retirements/deletions + dep-removal approvals) → Phase D (docs sync incl. README). Details, dependencies and approval gates live in `TASKS.md`.
