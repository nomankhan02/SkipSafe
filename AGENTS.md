<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## SkipSafe permanent project instructions

Read `MEMORY.md`, `TASKS.md` and `.agents/rules/skipsafe.md` before changing code. Verify claims against source, not only docs.

- **Protected files — never modify without explicit owner approval:** `src/lib/attendance.ts`, `src/lib/attendance.test.ts`, `src/lib/parseReport.ts`, `src/lib/parseReport.test.ts`. Preserve the attendance engine and PDF parser.
- **Privacy:** never store or log passwords, CAPTCHA answers, tokens, cookies, PDF bytes or extracted report text. Attendance data stays in the browser (React state) unless a separately approved backend design says otherwise. The theme key is the only allowed localStorage entry. Never commit real student PDFs or `.env*` files.
- **Honesty:** Milestone 1 adds a fail-closed NED connection boundary (three API routes + in-memory sessions), but the real NED portal flow is **not verified and live authentication is not functional**. Credentials temporarily reach this app's server during a future connection attempt; never claim they never reach a backend. Document hosting/provider logging retention before shipping live auth.
- **Testing gate for every task:** `npm run typecheck`, `npm run lint`, `npm run test:attendance`, `npm run test:parser`, `npm run test:ned`, `npm run build`, `npm run test:privacy`. Run privacy tests after build. Report pre-existing failures separately from new ones.
- **Security:** follow OWASP Top 10. CI runs CodeQL, Dependabot and dependency audits. Do not add analytics/monitoring/network SDKs without a privacy review. Do not run aggressive or unauthorized scans against the NED portal or production.
- **Workflow:** do not stage, commit, push, rewrite history or discard user changes unless explicitly asked. No dependency removals or forced audit fixes without approval.
