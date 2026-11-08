---
trigger: always_on
---

Project: SkipSafe, an attendance tool for university students. Stack: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4, shadcn/ui, framer-motion. Use shadcn components as the base. Follow the UI UX Pro Max skill (.agent/skills/ui-ux-pro-max) for design decisions. Design authority lives in MEMORY.md §6.

Design: Swiss editorial with instrument-panel course readouts in a responsive compact grid (grid-cols-1, sm:grid-cols-2, lg:grid-cols-3); Light/Dim/Dark themes via data-theme (Light is the foundation). Typography roles: Bricolage Grotesque (headings, display numbers, skips left primary collapsed readout at 40px/44px, expanded attendance percentages at 28px/32px, tabular-nums), Figtree (body, labels, metadata — never monospace for ordinary small text). Hairline borders, sharp geometry, minimal rounding. No glassmorphism, neon, gradients, particles, WebGL, or rotating 3D. Animations must be subtle and purposeful, and respect prefers-reduced-motion. Never rely on color alone for status; always add a text label; red only for actual danger. Status symbols use restrained, theme-aware geometric marks (polyline check for safe, geometric diamond for limit reached / 0 skips left, diagonal cross for danger, dash for not started).

Logic: all attendance numbers come from src/lib/attendance.ts. Never calculate attendance, skips or percentages in UI code or in AI responses. Real exam eligibility is 75% per course (HARD_LIMIT). The UI presents one clear metric: "Skips left" (the number of additional classes a student can skip while maintaining at least 75% attendance). Semester length is 15 teaching weeks (WEEKS_PER_SEMESTER).

Protected files: src/lib/attendance.ts, src/lib/attendance.test.ts, src/lib/parseReport.ts, src/lib/parseReport.test.ts — never modify without explicit approval; run `npm run test:attendance` and `npm run test:parser` after any approved change.

Privacy: never store or log passwords; never log CAPTCHA answers, session cookies, tokens, PDF contents or extracted student data. Credentials may temporarily reach the SkipSafe server **only** for a NED connection attempt; they must never be written to a session record, browser/server storage, a response body or a log. Keep student attendance data in the browser only. PDF uploads are parsed client-side with a bundled PDF.js worker; parsed courses live in React state only (no localStorage/IndexedDB persistence). Never commit .env files, API keys or real student PDFs. The theme preference is the only localStorage value permitted.

Backend caveat (important, do not misstate): Milestone 1 adds a **fail-closed NED boundary** (three server route handlers, isolated in-memory sessions, typed adapter) but **the real NED flow has not been verified and live authentication is not functional**. No NED endpoint, field name, CAPTCHA URL or report URL may be invented. The unconfigured adapter never contacts NED. Before shipping live auth: document hosting-provider logging/request tracing/crash-reporting retention, confirm HTTPS, and replace the process-local session store if deployment is multi-instance/serverless. Do not add analytics/monitoring SDKs that receive credentials, CAPTCHA answers, tokens, cookies, PDFs or attendance data.

Testing and security standard (run on every implementation task):
1. `npm run typecheck`
2. `npm run lint`
3. `npm run test:attendance`
4. `npm run test:parser` (requires a fixture; CI generates a synthetic one)
5. `npm run test:ned`
6. `npm run build`
7. `npm run test:privacy` (run after build so the client-bundle scan is active)
8. `npm audit --omit=dev` — triage findings; never use `--force`.

CI: `.github/workflows/ci.yml` runs all of the above on every push/PR. `.github/workflows/codeql.yml` runs CodeQL. `.github/dependabot.yml` covers npm and GitHub Actions. GitHub native secret scanning/push protection must be enabled in repository settings (not configurable in code). OWASP ZAP is NOT run: no staging environment exists. Do not scan the NED portal or production. When staging exists, run a ZAP baseline scan (unauthenticated, rate-limited) against that URL only, after written authorization, and store the report as a CI artifact. A passing test suite never proves the app is fully secure.
