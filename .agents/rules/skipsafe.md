---
trigger: always_on
---

Project: SkipSafe, an attendance tool for university students. Stack: Next.js 16 (App Router, TypeScript, Turbopack), Tailwind v4, shadcn/ui, framer-motion. Use shadcn components as the base. Follow the UI UX Pro Max skill (.agent/skills/ui-ux-pro-max) for design decisions. Design authority lives in MEMORY.md §6.

Design: Swiss editorial with instrument-panel course readouts; Light/Dim/Dark themes via data-theme (Light is the foundation). Typography roles: Bricolage Grotesque (headings), Figtree (body, labels, metadata — never monospace for ordinary small text), Silkscreen font-pixel (numeric readouts inside course panels only). Hairline borders, sharp geometry, minimal rounding. No glassmorphism, neon, gradients, particles, WebGL, or rotating 3D. Animations must be subtle and purposeful, and respect prefers-reduced-motion. Never rely on color alone for status; always add a text label; red only for actual danger.

Logic: all attendance numbers come from src/lib/attendance.ts. Never calculate attendance, skips or percentages in UI code or in AI responses. Real exam eligibility is 75% per course; the app shows a safe cushion at 80% and labels it clearly. Semester length is 15 teaching weeks (WEEKS_PER_SEMESTER).

Protected files: src/lib/attendance.ts, src/lib/attendance.test.ts, src/lib/parseReport.ts, src/lib/parseReport.test.ts — never modify without explicit approval; run both npx tsx suites after any approved change.

Privacy: never store, log or send passwords anywhere. Never log request bodies or PDF contents. Keep student data in the browser only. Never commit .env files, API keys or real student PDFs.
