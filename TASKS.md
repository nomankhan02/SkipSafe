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
- [x] Sample fixture `test-data/sample-attendance.pdf` — exists; `test-data/` gitignored
- [x] Dashboard with mock courses — commit `b1afd54`
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
- [x] Dashboard copy interpolated from constants (no hardcoded 16/75/80)
- [x] Parser logic and held attendance data preserved; both suites green

### Phase 1 — Design foundation (complete)

- [x] oklch Swiss-editorial token set; `--radius: 0.125rem`
- [x] Light / Dim / Dark themes via `data-theme` (+ `@custom-variant dark`); exactly three
- [x] Bricolage Grotesque + Figtree (+ then Geist Mono) via `next/font/google`
- [x] Theme persistence (localStorage) + pre-hydration `themeInit` script (no flash)
- [x] Status tokens `--status-safe/warning/danger` + `@theme` mappings

### Phase 2 — Editorial chrome (complete, incl. approved refinements)

- [x] `bg-background text-foreground` main; static **SSMonogram** replaces 3D logo in live UI
- [x] Masthead metadata rail (`15 TEACHING WEEKS · 6 COURSES · EXAM LIMIT 75% · CUSHION 80%`)
- [x] Flat 3-column summary readout band (replaces glass stat cards; ParticleNumber removed from use)
- [x] Flattened course cards (later superseded by Phase 3 rows)
- [x] **Cycling theme switch** — Light → Dim → Dark → Light; active swatch = filled + `border-2 border-foreground`; `aria-label` carries state
- [x] Global 260ms color-only theme transitions, guarded by `prefers-reduced-motion: no-preference`
- [x] Popover tokenized for all three themes (later superseded by Phase 3 inline details)
- [x] `v1.2` chip removed, no replacement
- [x] Monogram refined: interlocked/overlapping S's (still individually readable) + layered-carved depth (slab `.25` + carve floor `.16`), no gradients/animation

### Phase 3 — Course interface (complete 2026-10-31)

- [x] Course cards → **Swiss-editorial instrument rows**: header strip (`<button aria-expanded aria-controls>`, multi-open inline expansion, instant toggle) + recessed "screen" area (square, hairline, restrained contrast)
- [x] **`AttendanceScale.tsx`**: SVG `role="progressbar"`, 1 unit = 1%, 75/80 full-height ticks (foreground / status-safe), pixel-font threshold tags positioned to never collide; fill animated 0.65s with reduced-motion guard
- [x] **`PixelStatusSymbol.tsx`**: 7×7 crisp-edge pixel glyphs for safe (check), warning (exclamation), danger (✕), not_started (dash); `currentColor`; always paired with text label
- [x] **Silkscreen** pixel font added (`next/font/google`, weights 400/700, ~3.5KB subset files) as `font-pixel` — used **only** for panel numerals (percent `text-4xl/5xl`, SAFE/LIMIT counters `text-2xl`, scale tags `text-sm`, `[+]/[-]` indicator)
- [x] Typography correction: **Geist Mono loader removed**; `--font-mono` → system stack (code/kbd only); all ordinary labels/metadata → **Figtree**; summary-band display numbers → **Bricolage Grotesque**
- [x] MorphingPopover retired from the dashboard: all popover content preserved as inline expanded details (theory/practical breakdown + planned, cushion/eligibility skip rows, danger guidance, not-started note); popover dismissal sentence removed; `morphing-popover.tsx` file kept on disk (Phase 5)
- [x] Validation: both suites pass; lint 4e/3w (Phase 5 files only); build green; output checks verified (no popover markup, aria-expanded/controls present, font-pixel + Silkscreen CSS present, progressbar label includes thresholds)

**Explicitly NOT completed:** PDF upload wiring; chatbot implementation; file deletions/dependency removals; README rewrite; CI; deployment.

---

## 2. Current state (verified 2026-10-31)

- [x] UI is **mock-data only** — parser not wired into dashboard
- [x] No backend, no auth, no env secrets in use; no portal/CAPTCHA flow
- [x] Ask SkipSafe = stub button only
- [x] Tests are manual `tsx` scripts — not in `npm test`, not in CI
- [x] Lint baseline: **4 errors / 3 warnings — all in retired files** (morphing-popover, BackgroundParticleCanvas, Interactive3DLogo, ParticleNumber); live code clean
- [x] Build: `next build` (Turbopack) green; 5 static pages
- [x] `npm audit` remainder: 28 dev-toolchain findings (Phase S triage) — accepted, not fixed by force
- [x] Git: 4 commits (all ≤2026-10-14); **all phase work uncommitted/un-staged by instruction**
- [x] `README.md` still create-next-app boilerplate
- [x] Versioning: `v1.2` UI chip removed; `package.json` version still `0.1.0` — release versioning undecided

---

## 3. Known technical debt

- [ ] **Retirements (Phase 5, needs approval):** delete `Interactive3DLogo.tsx`, `BackgroundParticleCanvas.tsx`, `CardParticleCanvas.tsx`, `ParticleNumber.tsx`, `ui/morphing-popover.tsx` — files exist but are unused by live pages
- [ ] **Dependency removals (separate explicit approval):** `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`, `lenis` are installed but unused by live UI (also evaluate `@base-ui/react`, `cn`, `shadcn`, `motion` vs `framer-motion` overlap during that pass)
- [ ] **Lint debt (Phase 5):** 4 errors / 3 warnings in the retired files above (prefer-const ×2, no-explicit-any, static-components, unused vars ×2, exhaustive-deps)
- [ ] Unused shadcn primitives in `src/components/ui/` (input, label, toggle, card, badge — card/badge no longer imported by dashboard) — tidy in Phase 5
- [ ] `.agent/skills/ui-ux-pro-max/scripts/__pycache__/` committed in initial commit — cleanup candidate (Phase D)
- [ ] No `npm test` script; no CI
- [ ] README boilerplate; docs partially synced (MEMORY/TASKS rewritten 2026-10-31; README pending)

---

## 4. Phase 4 — Ask SkipSafe chatbot (awaiting explicit approval)

Approved direction so far (scope only — no implementation yet):

- [ ] Entry copy exactly: "Schedule changed? Ask SkipSafe." (already present in masthead)
- [ ] Five exact suggested questions (to be specified at Phase 4 planning)
- [ ] Answers computed **only** from `attendance.ts` outputs / mock data — never invented numbers
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

### PDF upload (MVP data path)

- [ ] Client-only upload control accepting PDF
- [ ] Configure pdfjs worker in the browser
- [ ] `parseAttendanceReport` → replace `MOCK_COURSES` in dashboard state
- [ ] Surface `ParseWarning[]` in UI without logging content
- [ ] Error states: wrong PDF, empty report, parse failure
- [ ] Clear/reset local data action

### Local persistence

- [ ] Choose storage (memory / localStorage / IndexedDB) for parsed courses
- [ ] Schema versioning + clear-data control; confirm no server sync by default

### University portal (deferred until explicit approval)

- [ ] Product decision: manual CAPTCHA + paste vs official API vs PDF-only
- [ ] Privacy/threat-model note in MEMORY **before any code**
- [ ] If built: no password storage/logging; manual CAPTCHA only

### Nice-to-have (not started)

- [ ] Per-course planned-hours overrides UI (`thPlanned` / `prPlanned`)
- [ ] Week/semester picker
- [ ] Export summary (no raw PDF) — privacy reviewed
- [ ] PWA/offline considerations

---

## 8. Testing and QA (outstanding)

- [x] Attendance + parser suites exist and pass (verified 2026-10-31)
- [ ] `package.json` `test` script running both suites
- [ ] CI (e.g., GitHub Actions): lint + tests + build on PR — none exists
- [ ] Component/UI tests (no runner installed)
- [ ] E2E: upload sample PDF → dashboard shows 6 courses (depends on PDF upload feature)
- [ ] Accessibility audit of instrument-panel dashboard (Phase 5)

---

## 9. Deployment and release preparation

- [ ] Decide host (Vercel assumed by boilerplate — unconfirmed)
- [ ] Production metadata / favicon / OG polish
- [ ] Security headers / CSP review once chatbot or external APIs exist (local Next docs: content-security-policy, data-security)
- [ ] Env var inventory: server-side secrets only; names without values
- [ ] Confirm `test-data/` and real PDFs never deploy or commit
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
PDF upload wiring ──► E2E test ──► real-data dashboard
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
