---
trigger: always_on
---

Project: SkipSafe, an attendance tool for university students. Stack: Next.js (App Router, TypeScript), Tailwind, shadcn/ui, Framer Motion, Lenis. Use shadcn components as the base. Follow the UI UX Pro Max skill for design decisions.

Design: dark, calm, clean, mobile-first. One custom color palette, at most two fonts. No default purple-blue gradients, no emoji as icons, no stock layouts with identical card grids. Animations must be subtle and purposeful, and respect prefers-reduced-motion. Never rely on color alone for status; always add a text label.

Logic: all attendance numbers come from src/lib/attendance.ts. Never calculate attendance, skips or percentages in UI code or in AI responses. Real exam eligibility is 75% per course; the app shows a safe cushion at 80% and labels it clearly.

Privacy: never store, log or send passwords anywhere. Never log request bodies or PDF contents. Keep student data in the browser only. Never commit .env files, API keys or real student PDFs.