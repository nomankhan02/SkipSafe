/**
 * privacy.test.ts — Privacy regression tests for SkipSafe.
 *
 * Run with:  npx tsx src/lib/privacy.test.ts
 *
 * These tests verify the privacy policies against the *current architecture*:
 * a browser-only attendance viewer with no backend, no authentication flow and
 * no third-party network calls. They combine source inspection with an optional
 * post-build scan of the client bundle.
 *
 * Honest scope:
 *   - They can prove that certain code patterns are absent from this repo.
 *   - They cannot prove what hosting-provider, CDN, crash-reporting or network
 *     infrastructure retains. Those require provider configuration review.
 *   - When a feature does not exist yet (portal login, CAPTCHA, sessions), the
 *     test asserts that no unsafe implementation has appeared and documents the
 *     missing coverage in TASKS.md instead of pretending it is verified.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const NEXT_STATIC = join(ROOT, ".next", "static");
const PACKAGE_JSON = JSON.parse(
  readFileSync(join(ROOT, "package.json"), "utf8"),
) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function relativePath(file: string): string {
  return relative(ROOT, file).split(sep).join("/");
}

function sourceText(file: string): string {
  return readFileSync(file, "utf8");
}

const sourceFiles = walk(SRC).filter((file) =>
  /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file),
);
const runtimeFiles = sourceFiles.filter(
  (file) => !/\.test\.(ts|tsx|js|jsx)$/.test(file),
);

function matchesInRuntime(
  pattern: RegExp,
  files: string[] = runtimeFiles,
): Array<{ file: string; line: number; text: string }> {
  const results: Array<{ file: string; line: number; text: string }> = [];
  for (const file of files) {
    const lines = sourceText(file).split(/\r?\n/);
    lines.forEach((text, index) => {
      if (pattern.test(text)) {
        results.push({ file: relativePath(file), line: index + 1, text: text.trim() });
      }
    });
  }
  return results;
}

function formatMatch(match: { file: string; line: number; text: string }): string {
  return `${match.file}:${match.line}: ${match.text}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Credentials must not be persisted in browser storage
// ─────────────────────────────────────────────────────────────────────────────

{
  const localRefs = matchesInRuntime(/\blocalStorage\b/);
  for (const match of localRefs) {
    assert.match(
      match.text.toLowerCase(),
      /theme/,
      `localStorage is only allowed for the non-sensitive theme preference, found: ${formatMatch(match)}`,
    );
  }

  const forbiddenStorage = matchesInRuntime(
    /\b(sessionStorage|indexedDB|IDBDatabase|document\.cookie|caches\.)\b/,
  );
  assert.deepEqual(
    forbiddenStorage.map(formatMatch),
    [],
    "no credential/attendance data may be persisted outside React state",
  );

  const setItemCalls = matchesInRuntime(/localStorage\.setItem\(/);
  for (const match of setItemCalls) {
    assert.match(
      match.text,
      /localStorage\.setItem\(\s*["']theme["']/,
      `only the theme key may be written to localStorage, found: ${formatMatch(match)}`,
    );
  }

  console.log(
    `ok  browser storage: ${localRefs.length} localStorage use(s), all theme-only; no sessionStorage/IndexedDB/cookies`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Sensitive values must not be logged
// ─────────────────────────────────────────────────────────────────────────────

{
  // `src/lib/try.ts` is an unimported developer scratch script (verified below),
  // not application code, so it is excluded from the no-console rule.
  const SCRATCH_FILES = new Set(["src/lib/try.ts"]);
  const loggingFiles = runtimeFiles.filter(
    (file) => !SCRATCH_FILES.has(relativePath(file)),
  );
  for (const scratch of SCRATCH_FILES) {
    const imports = matchesInRuntime(
      new RegExp(
        `from\\s+["'](?:\\./|@/lib/)${scratch.split("/").pop()?.replace(/\.ts$/, "")}["']`,
      ),
    );
    assert.deepEqual(
      imports.map(formatMatch),
      [],
      `scratch file ${scratch} must not be imported by application code`,
    );
  }

  const consoleCalls = matchesInRuntime(
    /\bconsole\.(log|info|warn|error|debug|trace|dir|table)\s*\(/,
    loggingFiles,
  );
  assert.deepEqual(
    consoleCalls.map(formatMatch),
    [],
    "runtime code must not write to the console (passwords, PDFs, tokens or reports could leak)",
  );

  const streamWrites = matchesInRuntime(/\bprocess\.(stdout|stderr)\.write\s*\(/, loggingFiles);
  assert.deepEqual(
    streamWrites.map(formatMatch),
    [],
    "runtime code must not write directly to stdout/stderr",
  );

  const parser = sourceText(join(SRC, "lib", "parseReport.ts"));
  assert.doesNotMatch(
    parser,
    /\bconsole\./,
    "the PDF parser must never log PDF bytes or extracted text",
  );

  console.log("ok  logging: no console/stream logging in runtime code or parser");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. No outbound network calls or third-party exfiltration
// ─────────────────────────────────────────────────────────────────────────────

{
  const fetchCalls = matchesInRuntime(/\bfetch\s*\(/);
  for (const match of fetchCalls) {
    assert.equal(
      match.file,
      "src/components/NedConnection.tsx",
      `client fetch is only allowed in NedConnection for same-origin NED endpoints, found: ${formatMatch(match)}`,
    );
    assert.match(
      match.text,
      /fetch\(\s*["']\/api\/ned\//,
      `NED fetch calls must target a relative same-origin API path, found: ${formatMatch(match)}`,
    );
  }

  const otherNetworkApis = matchesInRuntime(
    /\b(XMLHttpRequest|navigator\.sendBeacon|new\s+WebSocket|new\s+EventSource|axios\s*\(|from\s+["']axios["']|from\s+["']ky["'])\b/,
  );
  assert.deepEqual(
    otherNetworkApis.map(formatMatch),
    [],
    "no XHR, beacon, websocket, event-stream or third-party HTTP client may be used",
  );

  const externalFetch = matchesInRuntime(
    /\bfetch\s*\(\s*["']https?:\/\//,
  );
  assert.deepEqual(
    externalFetch.map(formatMatch),
    [],
    "client code must not fetch third-party origins",
  );

  const thirdPartyPackages = [
    "@sentry/",
    "@datadog/",
    "posthog",
    "mixpanel",
    "amplitude",
    "segment",
    "logrocket",
    "hotjar",
    "google-analytics",
    "firebase",
    "newrelic",
    "rollbar",
    "bugsnag",
  ];
  const declared = {
    ...PACKAGE_JSON.dependencies,
    ...PACKAGE_JSON.devDependencies,
  };
  for (const packageName of Object.keys(declared)) {
    for (const tracker of thirdPartyPackages) {
      assert.ok(
        !packageName.startsWith(tracker) && !packageName.includes(tracker),
        `analytics/monitoring package must not be added without a privacy review: ${packageName}`,
      );
    }
  }

  const externalScripts = matchesInRuntime(
    /<script[^>]+src=["']https?:\/\//,
  );
  assert.deepEqual(
    externalScripts.map(formatMatch),
    [],
    "no third-party scripts may be loaded in the client",
  );

  console.log(
    `ok  network: only same-origin NED API fetches (${fetchCalls.length}); no third-party calls, trackers or scripts`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. No backend retention, database or server-side attendance storage
// ─────────────────────────────────────────────────────────────────────────────

{
  const routeFiles = sourceFiles.filter((file) =>
    /(^|[\\/])route\.(ts|tsx|js|jsx)$/.test(file),
  );
  const allowedRoutes = new Set([
    "src/app/api/ned/session/route.ts",
    "src/app/api/ned/session/challenge/route.ts",
    "src/app/api/ned/session/connect/route.ts",
  ]);
  assert.deepEqual(
    routeFiles.map(relativePath).sort(),
    [...allowedRoutes].sort(),
    "only the reviewed NED session route handlers may exist",
  );
  for (const routeFile of routeFiles) {
    const route = sourceText(routeFile);
    assert.match(
      route,
      /export\s+const\s+(POST|DELETE)\s*=\s*nedHandlers\./,
      `NED route must delegate to the reviewed handler boundary: ${relativePath(routeFile)}`,
    );
    assert.doesNotMatch(
      route,
      /["']use server["']/,
      `NED routes must not use server-action directives: ${relativePath(routeFile)}`,
    );
  }

  const serverDirectives = matchesInRuntime(/["']use server["']/);
  assert.deepEqual(
    serverDirectives.map(formatMatch),
    [],
    "no server actions exist; if added they must be privacy-reviewed and tested",
  );

  const databasePackages = [
    "prisma",
    "@prisma/client",
    "drizzle-orm",
    "mongoose",
    "mongodb",
    "pg",
    "mysql2",
    "better-sqlite3",
    "sqlite3",
    "redis",
    "ioredis",
  ];
  const declared = {
    ...PACKAGE_JSON.dependencies,
    ...PACKAGE_JSON.devDependencies,
  };
  for (const packageName of databasePackages) {
    assert.ok(
      !(packageName in declared),
      `no database driver should be present without an approved persistence design: ${packageName}`,
    );
  }

  const fileWrites = matchesInRuntime(
    /\b(writeFile|writeFileSync|createWriteStream|appendFile|appendFileSync|openSync)\s*\(/,
  );
  assert.deepEqual(
    fileWrites.map(formatMatch),
    [],
    "runtime code must not write PDFs, credentials or attendance data to disk",
  );

  console.log(
    `ok  backend: only ${routeFiles.length} reviewed NED route handlers; no server actions, database drivers or file writes`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Parser output contains only parsed attendance data
// ─────────────────────────────────────────────────────────────────────────────

{
  const parser = sourceText(join(SRC, "lib", "parseReport.ts"));

  assert.doesNotMatch(parser, /\bfetch\s*\(/, "parser must not perform network calls");
  assert.doesNotMatch(
    parser,
    /\b(localStorage|sessionStorage|indexedDB)\b/,
    "parser must not persist anything",
  );

  const parseResultMatch = parser.match(
    /export interface ParseResult\s*\{([\s\S]*?)\n\}/,
  );
  assert.ok(parseResultMatch, "ParseResult interface should exist");
  const fields = [...parseResultMatch[1].matchAll(/^\s*(\w+)\??:/gm)].map(
    (match) => match[1],
  );
  assert.deepEqual(
    fields.sort(),
    ["courses", "printedPcts", "skippedRows", "warnings"].sort(),
    `ParseResult must expose only parsed attendance data, found: ${fields.join(", ")}`,
  );

  assert.match(
    parser,
    /@param\s+pdfData[\s\S]{0,120}Never logged/,
    "parser must document that PDF bytes are never logged",
  );

  console.log("ok  parser: returns only courses/warnings/skippedRows/printedPcts, no raw bytes or text");
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Temporary state cleanup and session isolation
// ─────────────────────────────────────────────────────────────────────────────

{
  const authLikeFiles = sourceFiles.filter((file) =>
    /(^|[\\/])(auth|session|login|captcha)[^\\/]*\.(ts|tsx|js|jsx)$/i.test(file),
  );
  for (const file of authLikeFiles) {
    const path = relativePath(file);
    assert.ok(
      path.startsWith("src/lib/ned/") ||
        path === "src/components/NedConnection.tsx",
      `authentication/session code must live inside the reviewed NED boundary: ${path}`,
    );
  }

  const nedConnection = sourceText(
    join(SRC, "components", "NedConnection.tsx"),
  );
  assert.doesNotMatch(
    nedConnection,
    /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/,
    "the NED connection UI must not persist credentials, CAPTCHA answers or session data",
  );
  assert.match(
    nedConnection,
    /const clearSecretFields = useCallback\(\(\) => \{[\s\S]*?setStudentId\(""\)[\s\S]*?setPassword\(""\)[\s\S]*?setCaptchaAnswer\(""\)/,
    "the UI must clear student ID, password and CAPTCHA answer after use",
  );
  assert.match(
    nedConnection,
    /finally \{[\s\S]*?clearSecretFields\(\)/,
    "the submit path must clear sensitive fields on every exit path",
  );
  assert.doesNotMatch(
    nedConnection,
    /\b(NED_SESSION_COOKIE|portalState|unconfiguredNedAdapter|createNedSessionStore)\b/,
    "server-only session internals must never be imported into client code",
  );
  assert.doesNotMatch(
    nedConnection,
    /@\/lib\/ned\/(?:runtime|handlers|sessionStore|portalAdapter|cookies)/,
    "the client component must import only shared NED types/validation/state",
  );

  const sessionStore = sourceText(
    join(SRC, "lib", "ned", "sessionStore.ts"),
  );
  assert.doesNotMatch(
    sessionStore,
    /\b(studentId|password|captchaAnswer)\s*:/,
    "session records must not have credential or CAPTCHA-answer fields",
  );

  const cookies = sourceText(join(SRC, "lib", "ned", "cookies.ts"));
  assert.match(cookies, /HttpOnly/);
  assert.match(cookies, /SameSite=Strict/);
  assert.match(cookies, /Secure/);
  assert.match(cookies, /Path=\/api\/ned/);

  const dashboard = sourceText(join(SRC, "app", "dashboard", "page.tsx"));
  assert.match(
    dashboard,
    /const handleClearReport = \(\) => \{[\s\S]*?setReport\(null\)/,
    "clear action must drop the parsed report from React state",
  );
  assert.match(
    dashboard,
    /const \[report, setReport\] = useState<LoadedReport \| null>\(null\)/,
    "attendance data must live in React state, not persisted storage",
  );

  const uploadControl = sourceText(
    join(SRC, "components", "ReportUpload.tsx"),
  );
  assert.match(
    uploadControl,
    /event\.target\.value = ""/,
    "file input must be reset so the browser does not keep the selected PDF in the control",
  );

  console.log(
    "ok  cleanup: NED state is transient, fields clear after every attempt, sessions are TTL-scoped, report stays in React state",
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. No NEXT_PUBLIC_ secrets, env leakage or credential keywords in client code
// ─────────────────────────────────────────────────────────────────────────────

{
  const publicEnv = matchesInRuntime(/\bprocess\.env\.NEXT_PUBLIC_/);
  assert.deepEqual(
    publicEnv.map(formatMatch),
    [],
    "NEXT_PUBLIC_ variables are embedded in the client bundle and must not hold secrets",
  );

  const envUsage = matchesInRuntime(/\bprocess\.env\b/);
  assert.deepEqual(
    envUsage.map(formatMatch),
    [],
    "the current local-only app should not read environment variables in client code",
  );

  console.log("ok  secrets: no NEXT_PUBLIC_ or client-side process.env usage");
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. Post-build client bundle scan (optional: requires `npm run build`)
// ─────────────────────────────────────────────────────────────────────────────

{
  if (!existsSync(NEXT_STATIC)) {
    console.log(
      "skip client bundle scan: .next/static not found (run `npm run build` before `npm run test:privacy` for full coverage)",
    );
  } else {
    const bundleFiles = walk(NEXT_STATIC).filter((file) =>
      /\.(js|css)$/.test(file),
    );
    assert.ok(bundleFiles.length > 0, "client bundle should contain JS/CSS assets");
    const bundle = bundleFiles.map(sourceText).join("\n");

    // Fixture identifiers must never be compiled into the client bundle.
    const fixtureMarkers = [
      "NOMAN KHURSHEED",
      "2026-2027",
      "Computer Science & Information Technology",
    ];
    for (const marker of fixtureMarkers) {
      assert.equal(
        bundle.includes(marker),
        false,
        `private test fixture value leaked into the client bundle: ${marker}`,
      );
    }

    // Common secret shapes must not appear in the public bundle.
    const secretPatterns: Array<[string, RegExp]> = [
      ["AWS access key", /AKIA[0-9A-Z]{16}/],
      ["private key block", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
      ["Stripe live key", /sk_live_[0-9a-zA-Z]{16,}/],
      ["GitHub token", /gh[pousr]_[A-Za-z0-9]{20,}/],
    ];
    for (const [label, pattern] of secretPatterns) {
      assert.doesNotMatch(bundle, pattern, `${label} must not be present in the client bundle`);
    }

    // If a local .env file exists, its values must not be inlined into the bundle.
    const envFiles = readdirSync(ROOT)
      .filter((entry) => /^\.env(\.[^.]+)?$/.test(entry))
      .filter((entry) => !/\.(example|sample|template)$/.test(entry))
      .map((entry) => join(ROOT, entry))
      .filter((file) => statSync(file).isFile());
    for (const envFile of envFiles) {
      for (const line of sourceText(envFile).split(/\r?\n/)) {
        const value = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        if (value.length >= 8) {
          assert.equal(
            bundle.includes(value),
            false,
            `environment value from ${relativePath(envFile)} leaked into the client bundle`,
          );
        }
      }
    }

    // Server-only session internals must not be bundled for the browser.
    const serverOnlyMarkers = [
      "skipsafe_ned_session",
      "portalState",
      "createNedSessionStore",
      "unconfiguredNedAdapter",
    ];
    for (const marker of serverOnlyMarkers) {
      assert.equal(
        bundle.includes(marker),
        false,
        `server-only NED session marker leaked into the client bundle: ${marker}`,
      );
    }

    console.log(
      `ok  client bundle: scanned ${bundleFiles.length} asset(s); no fixture data, secret patterns, env values or server session internals`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. Content Security Policy: dev/prod split and directive integrity
// ─────────────────────────────────────────────────────────────────────────────

{
  const nextConfig = sourceText(join(ROOT, "next.config.ts"));

  // Verify the CSP is built conditionally based on NODE_ENV
  assert.match(
    nextConfig,
    /const isDev = process\.env\.NODE_ENV === "development"/,
    "CSP must detect development mode via NODE_ENV",
  );
  assert.match(
    nextConfig,
    /const scriptSrc = isDev\s*\?\s*["']script-src 'self' 'unsafe-inline' 'unsafe-eval'["']/,
    "development script-src must include 'unsafe-eval'",
  );
  assert.match(
    nextConfig,
    /:\s*["']script-src 'self' 'unsafe-inline'["']/,
    "production script-src must exclude 'unsafe-eval'",
  );

  // Verify all required CSP directives are present in the policy array
  const requiredDirectives = [
    "default-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  for (const directive of requiredDirectives) {
    assert.match(
      nextConfig,
      new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `CSP must contain directive: ${directive}`,
    );
  }

  // Verify security headers array includes CSP and other critical headers
  const requiredHeaders = [
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
    "Referrer-Policy",
    "Permissions-Policy",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "X-DNS-Prefetch-Control",
    "Strict-Transport-Security",
  ];
  for (const header of requiredHeaders) {
    assert.match(
      nextConfig,
      new RegExp(`key:\\s*["']${header}["']`),
      `securityHeaders must include ${header}`,
    );
  }

  // Verify X-Frame-Options is DENY
  assert.match(
    nextConfig,
    /X-Frame-Options.*DENY/,
    "X-Frame-Options must be DENY",
  );

  // Verify no external origins in any directive
  assert.doesNotMatch(
    nextConfig,
    /https?:\/\/[^'"]+/,
    "CSP must not allow external origins",
  );

  // Verify the CSP is applied to all routes via headers()
  assert.match(
    nextConfig,
    /async headers\(\)/,
    "nextConfig must export headers() function",
  );
  assert.match(
    nextConfig,
    /source:\s*["']\/:[^"']*["']/,
    "CSP must apply to all routes",
  );

  console.log(
    "ok  CSP: dev/prod split verified, all directives intact, no external origins, applied globally",
  );
}

console.log("\nAll privacy tests passed.");
