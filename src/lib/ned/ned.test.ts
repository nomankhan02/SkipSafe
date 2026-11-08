/**
 * NED connection boundary tests.
 *
 * Run with: npm run test:ned
 *
 * These tests use an injected fake adapter and a throw-away session store. They
 * never contact the NED portal and never use real credentials.
 */

import assert from "node:assert/strict";
import {
  MAX_CAPTCHA_ANSWER_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_STUDENT_ID_LENGTH,
  NED_FIELD_MESSAGES,
  validateNedCredentials,
} from "./validation";
import {
  NED_ERROR_MESSAGES,
  initialNedUiState,
  nedConnectedState,
  nedConnectingState,
  nedErrorState,
  nedLoadingCaptchaState,
  nedReadyState,
} from "./connectionState";
import {
  NED_SESSION_COOKIE,
  parseCookieHeader,
  readNedSessionId,
  serializeClearedNedSessionCookie,
  serializeNedSessionCookie,
} from "./cookies";
import { createNedSessionStore } from "./sessionStore";
import { createNedHandlers } from "./handlers";
import { unconfiguredNedAdapter } from "./portalAdapter";
import type { NedPortalAdapter } from "./portalAdapter";
import type { NedErrorCode } from "./types";

function log(message: string): void {
  // Tests are allowed to print their own progress; runtime code is not.
  process.stdout.write(`ok  ${message}\n`);
}

async function main(): Promise<void> {

// ─────────────────────────────────────────────────────────────────────────────
// 1. Validation and user-facing error states
// ─────────────────────────────────────────────────────────────────────────────

{
  const valid = validateNedCredentials({
    studentId: "  SE-2026-001  ",
    password: " pass phrase ",
    captchaAnswer: "  AbC12  ",
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.value.studentId, "SE-2026-001");
    assert.equal(valid.value.password, " pass phrase ");
    assert.equal(valid.value.captchaAnswer, "AbC12");
  }

  const missing = validateNedCredentials({});
  assert.deepEqual(missing, {
    ok: false,
    fields: ["studentId", "password", "captchaAnswer"],
  });

  const oversized = validateNedCredentials({
    studentId: "x".repeat(MAX_STUDENT_ID_LENGTH + 1),
    password: "x".repeat(MAX_PASSWORD_LENGTH + 1),
    captchaAnswer: "x".repeat(MAX_CAPTCHA_ANSWER_LENGTH + 1),
  });
  assert.deepEqual(oversized, {
    ok: false,
    fields: ["studentId", "password", "captchaAnswer"],
  });

  const controlCharacters = validateNedCredentials({
    studentId: "SE\n2026",
    password: "secret\u0000value",
    captchaAnswer: "A\tB",
  });
  assert.deepEqual(controlCharacters, {
    ok: false,
    fields: ["studentId", "password", "captchaAnswer"],
  });

  const nonObject = validateNedCredentials("not an object");
  assert.equal(nonObject.ok, false);

  const secret = "VERY-SECRET-VALUE";
  const failing = validateNedCredentials({
    studentId: `${secret}\u0000`,
    password: "a-valid-password",
    captchaAnswer: "AbC12",
  });
  assert.equal(failing.ok, false);
  assert.equal(JSON.stringify(failing).includes(secret), false);

  for (const message of Object.values(NED_FIELD_MESSAGES)) {
    assert.ok(message.length > 0);
  }

  const codes: NedErrorCode[] = [
    "invalid_request",
    "integration_unavailable",
    "invalid_credentials",
    "captcha_failed",
    "portal_unavailable",
    "timeout",
    "session_expired",
    "too_many_requests",
    "attendance_retrieval_failed",
  ];
  for (const code of codes) {
    const state = nedErrorState(code);
    assert.equal(state.status, "error");
    assert.equal(state.message, NED_ERROR_MESSAGES[code]);
    assert.ok(state.message.length > 0);
    assert.equal(state.captchaImage, null);
  }

  assert.equal(initialNedUiState.status, "idle");
  assert.equal(nedLoadingCaptchaState().status, "loading_captcha");
  assert.equal(nedReadyState("data:image/png;base64,AAAA", 123).status, "ready");
  assert.equal(
    nedConnectingState(nedReadyState("data:image/png;base64,AAAA", 123)).status,
    "connecting",
  );
  assert.equal(nedConnectedState(123).status, "connected");

  log("validation and error states: required fields, limits, clearing-safe messages");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Cookie handling and sensitive-flag serialization
// ─────────────────────────────────────────────────────────────────────────────

{
  const cookies = parseCookieHeader(
    "theme=dark; skipsafe_ned_session=abc; malformed; spaced = value ",
  );
  assert.equal(cookies.get("theme"), "dark");
  assert.equal(cookies.get("skipsafe_ned_session"), "abc");
  assert.equal(cookies.get("spaced"), "value");

  const validId = "a".repeat(43);
  const request = new Request("http://localhost/api/ned/session/connect", {
    headers: { cookie: `${NED_SESSION_COOKIE}=${validId}` },
  });
  assert.equal(readNedSessionId(request), validId);

  const malformed = new Request("http://localhost/api/ned/session/connect", {
    headers: { cookie: `${NED_SESSION_COOKIE}=short` },
  });
  assert.equal(readNedSessionId(malformed), null);

  const serialized = serializeNedSessionCookie(validId, 300, true);
  assert.match(serialized, /HttpOnly/);
  assert.match(serialized, /SameSite=Strict/);
  assert.match(serialized, /Path=\/api\/ned/);
  assert.match(serialized, /Max-Age=300/);
  assert.match(serialized, /Secure/);
  assert.equal(serialized.includes(validId), true);

  const insecure = serializeNedSessionCookie(validId, 300, false);
  assert.equal(insecure.includes("Secure"), false);

  const cleared = serializeClearedNedSessionCookie(true);
  assert.match(cleared, /Max-Age=0/);
  assert.match(cleared, /HttpOnly/);
  assert.match(cleared, /SameSite=Strict/);

  log("cookies: HttpOnly, SameSite=Strict, path-scoped, Secure on HTTPS");
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Session isolation, TTL and absence of credential fields
// ─────────────────────────────────────────────────────────────────────────────

{
  let clock = 1_000;
  let counter = 0;
  const store = createNedSessionStore({
    ttlMs: 100,
    maxSessions: 2,
    now: () => clock,
    idFactory: () => `${String(++counter).padStart(43, "0")}`,
  });

  const first = store.create({ portalCookie: "one" });
  const second = store.create({ portalCookie: "two" });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) throw new Error("session creation failed");

  assert.notEqual(first.id, second.id);
  assert.equal(store.size(), 2);
  assert.equal(store.get(first.id)?.portalState instanceof Object, true);

  const third = store.create({ portalCookie: "three" });
  assert.deepEqual(third, { ok: false, code: "too_many_requests" });

  const firstRecord = store.get(first.id);
  assert.ok(firstRecord);
  const serializedRecord = JSON.stringify(firstRecord);
  assert.equal(serializedRecord.includes("password"), false);
  assert.equal(serializedRecord.includes("studentId"), false);
  assert.equal(serializedRecord.includes("captchaAnswer"), false);
  assert.deepEqual(Object.keys(firstRecord).sort(), [
    "createdAt",
    "expiresAt",
    "phase",
    "portalState",
  ]);

  store.delete(first.id);
  assert.equal(store.get(first.id), null);
  assert.ok(store.get(second.id), "deleting one session must not affect another");

  const updated = store.markConnected(second.id, { portalCookie: "two-updated" });
  assert.equal(updated?.phase, "connected");
  assert.deepEqual(updated?.portalState, { portalCookie: "two-updated" });

  clock += 101;
  assert.equal(store.get(second.id), null, "expired sessions must be removed");
  assert.equal(store.size(), 0);

  log("session store: unique IDs, per-session isolation, TTL expiry, no credential fields");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Handler boundary: fail closed, validation, cleanup and error mapping
// ─────────────────────────────────────────────────────────────────────────────

type FakeAdapterOptions = {
  authResult?:
    | { ok: true; portalState: unknown }
    | { ok: false; code: NedErrorCode };
  beginResult?:
    | { ok: true; captchaImage: string; portalState: unknown }
    | { ok: false; code: NedErrorCode };
  throwOnAuth?: boolean;
  hangOnAuth?: boolean;
};

function createFakeAdapter(options: FakeAdapterOptions = {}): {
  adapter: NedPortalAdapter;
  state: { lastAuth: unknown };
} {
  const state: { lastAuth: unknown } = { lastAuth: null };
  const adapter: NedPortalAdapter = {
    id: "test",
    isConfigured: true,
    async beginChallenge() {
      return (
        options.beginResult ?? {
          ok: true,
          captchaImage: "data:image/png;base64,AAAA",
          portalState: { portalCookie: "initial" },
        }
      );
    },
    async authenticate(input) {
      state.lastAuth = input;
      if (options.hangOnAuth) {
        return new Promise(() => {
          // Intentionally never settles; the handler timeout must win.
        });
      }
      if (options.throwOnAuth) throw new Error("adapter failure");
      return (
        options.authResult ?? {
          ok: true,
          portalState: { portalCookie: "authenticated" },
        }
      );
    },
    async fetchAttendanceReport() {
      return { ok: false, code: "integration_unavailable" };
    },
  };
  return { adapter, state };
}

function makeRequest(
  path: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    rawBody?: string;
    contentType?: string | null;
    origin?: string;
  } = {},
): Request {
  const headers = new Headers();
  headers.set("content-type", options.contentType ?? "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.origin) headers.set("origin", options.origin);

  return new Request(`http://localhost${path}`, {
    method: options.method ?? "POST",
    headers,
    body:
      options.rawBody ??
      (options.body === undefined ? undefined : JSON.stringify(options.body)),
  });
}

function setCookie(response: Response): string | null {
  const header = response.headers.get("set-cookie");
  if (!header) return null;
  return header.split(";")[0] ?? null;
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

{
  const unconfiguredStore = createNedSessionStore();
  const unconfigured = createNedHandlers({
    store: unconfiguredStore,
    adapter: unconfiguredNedAdapter,
  });

  const response = await unconfigured.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  assert.equal(response.status, 503);
  assert.equal(setCookie(response), null);
  assert.deepEqual(await json(response), {
    ok: false,
    code: "integration_unavailable",
  });
  assert.equal(unconfiguredStore.size(), 0);
  assert.deepEqual(await unconfiguredNedAdapter.beginChallenge(), {
    ok: false,
    code: "integration_unavailable",
  });

  log("unconfigured adapter: fails closed, creates no session, sets no cookie");
}

{
  const clock = 10_000;
  const store = createNedSessionStore({ now: () => clock });
  const fake = createFakeAdapter();
  const handlers = createNedHandlers({
    store,
    adapter: fake.adapter,
    now: () => clock,
  });

  const challenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  assert.equal(challenge.status, 200);
  const challengeBody = await json(challenge);
  assert.equal(challengeBody.ok, true);
  assert.equal(challengeBody.captchaImage, "data:image/png;base64,AAAA");
  assert.equal(typeof challengeBody.expiresAt, "number");
  assert.equal(JSON.stringify(challengeBody).includes("portalCookie"), false);

  const cookie = setCookie(challenge);
  assert.ok(cookie, "challenge must set the HttpOnly session cookie");
  const rawCookieHeader = challenge.headers.get("set-cookie");
  assert.ok(rawCookieHeader);
  assert.match(rawCookieHeader, /HttpOnly/);
  assert.match(rawCookieHeader, /SameSite=Strict/);
  assert.match(challenge.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal(store.size(), 1);

  const credentials = {
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
  };

  const connected = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: credentials,
    }),
  );
  assert.equal(connected.status, 200);
  const connectedBody = await json(connected);
  assert.deepEqual(Object.keys(connectedBody).sort(), [
    "expiresAt",
    "ok",
    "status",
  ]);
  assert.equal(connectedBody.ok, true);
  assert.equal(connectedBody.status, "connected");
  assert.equal(JSON.stringify(connectedBody).includes(credentials.password), false);
  assert.equal(JSON.stringify(connectedBody).includes(credentials.studentId), false);
  assert.equal(JSON.stringify(connectedBody).includes(credentials.captchaAnswer), false);

  const authInput = fake.state.lastAuth as Record<string, unknown>;
  assert.equal(authInput.studentId, credentials.studentId);
  assert.equal(authInput.password, credentials.password);
  assert.equal(authInput.captchaAnswer, credentials.captchaAnswer);

  const stored = store.get(cookie.split("=")[1] ?? "");
  assert.ok(stored);
  assert.equal(stored.phase, "connected");
  const storedText = JSON.stringify(stored);
  assert.equal(storedText.includes(credentials.password), false);
  assert.equal(storedText.includes(credentials.studentId), false);
  assert.equal(storedText.includes(credentials.captchaAnswer), false);

  log("connect: adapter receives credentials transiently; session stores no credentials");
}

{
  const clock = 20_000;
  const store = createNedSessionStore({ now: () => clock });
  const fake = createFakeAdapter({
    authResult: { ok: false, code: "invalid_credentials" },
  });
  const handlers = createNedHandlers({
    store,
    adapter: fake.adapter,
    now: () => clock,
  });

  const challenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const cookie = setCookie(challenge);
  assert.ok(cookie);

  const failed = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: {
        studentId: "SE-2026-001",
        password: "wrong",
        captchaAnswer: "AbC12",
      },
    }),
  );
  assert.equal(failed.status, 401);
  assert.deepEqual(await json(failed), {
    ok: false,
    code: "invalid_credentials",
  });
  const cleared = failed.headers.get("set-cookie");
  assert.ok(cleared);
  assert.match(cleared, /Max-Age=0/);
  assert.equal(store.size(), 0, "failed authentication must delete the session");

  log("failed authentication: mapped status, session deleted, cookie cleared");
}

{
  const clock = 30_000;
  const store = createNedSessionStore({ now: () => clock });
  const handlers = createNedHandlers({
    store,
    adapter: createFakeAdapter({ throwOnAuth: true }).adapter,
    now: () => clock,
  });

  const challenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const cookie = setCookie(challenge);
  assert.ok(cookie);

  const response = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: {
        studentId: "SE-2026-001",
        password: "secret",
        captchaAnswer: "AbC12",
      },
    }),
  );
  assert.equal(response.status, 502);
  const responseBody = await json(response);
  assert.deepEqual(responseBody, {
    ok: false,
    code: "portal_unavailable",
  });
  assert.equal(store.size(), 0);
  assert.equal(JSON.stringify(responseBody).includes("secret"), false);

  log("adapter exception: mapped to portal_unavailable without leaking details");
}

{
  const clock = 40_000;
  const store = createNedSessionStore({ now: () => clock });
  const handlers = createNedHandlers({
    store,
    adapter: createFakeAdapter({ hangOnAuth: true }).adapter,
    now: () => clock,
    operationTimeoutMs: 5,
  });

  const challenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const cookie = setCookie(challenge);
  assert.ok(cookie);

  const started = Date.now();
  const response = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: {
        studentId: "SE-2026-001",
        password: "secret",
        captchaAnswer: "AbC12",
      },
    }),
  );
  assert.equal(response.status, 504);
  assert.deepEqual(await json(response), { ok: false, code: "timeout" });
  assert.ok(Date.now() - started < 1_000);
  assert.equal(store.size(), 0);

  log("timeout: bounded operation, session deleted, no credential leak");
}

{
  let clock = 50_000;
  const store = createNedSessionStore({ now: () => clock });
  const fake = createFakeAdapter();
  const handlers = createNedHandlers({
    store,
    adapter: fake.adapter,
    now: () => clock,
  });

  const badOrigin = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge", {
      origin: "https://evil.example",
    }),
  );
  assert.equal(badOrigin.status, 403);

  const badContentType = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      contentType: "text/plain",
      body: {},
    }),
  );
  assert.equal(badContentType.status, 415);

  const challenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const cookie = setCookie(challenge);
  assert.ok(cookie);

  const badJson = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      rawBody: "{not-json",
    }),
  );
  assert.equal(badJson.status, 400);

  const oversized = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      rawBody: JSON.stringify({ padding: "x".repeat(9 * 1024) }),
    }),
  );
  assert.equal(oversized.status, 413);

  const missingFields = await handlers.connect(
    makeRequest("/api/ned/session/connect", { cookie, body: {} }),
  );
  assert.equal(missingFields.status, 400);
  const missingBody = await json(missingFields);
  assert.deepEqual(missingBody, {
    ok: false,
    code: "invalid_request",
    fields: ["studentId", "password", "captchaAnswer"],
  });

  const expired = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie: `${NED_SESSION_COOKIE}=${"z".repeat(43)}`,
      body: {
        studentId: "SE-2026-001",
        password: "secret",
        captchaAnswer: "AbC12",
      },
    }),
  );
  assert.equal(expired.status, 401);
  assert.deepEqual(await json(expired), {
    ok: false,
    code: "session_expired",
  });

  clock += 6 * 60 * 1000;
  const expiredSession = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: {
        studentId: "SE-2026-001",
        password: "secret",
        captchaAnswer: "AbC12",
      },
    }),
  );
  assert.equal(expiredSession.status, 401);
  assert.equal(store.size(), 0);

  log("request hardening: origin, content type, size, malformed JSON, expiry");
}

{
  const store = createNedSessionStore();
  const handlers = createNedHandlers({
    store,
    adapter: createFakeAdapter().adapter,
  });

  const first = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const firstCookie = setCookie(first);
  assert.ok(firstCookie);

  const second = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge", { cookie: firstCookie }),
  );
  const secondCookie = setCookie(second);
  assert.ok(secondCookie);
  assert.notEqual(firstCookie, secondCookie);
  assert.equal(store.size(), 1, "a refreshed CAPTCHA replaces the prior session");

  const disconnected = await handlers.disconnect(
    makeRequest("/api/ned/session", {
      method: "DELETE",
      cookie: secondCookie,
      contentType: null,
    }),
  );
  assert.equal(disconnected.status, 200);
  assert.deepEqual(await json(disconnected), { ok: true });
  assert.match(disconnected.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.equal(store.size(), 0);

  log("disconnect/refresh: only the presented session is removed");
}

{
  const store = createNedSessionStore();
  const handlers = createNedHandlers({
    store,
    adapter: createFakeAdapter({
      beginResult: {
        ok: true,
        captchaImage: "https://evil.example/captcha.png",
        portalState: {},
      },
    }).adapter,
  });

  const response = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  assert.equal(response.status, 502);
  assert.deepEqual(await json(response), {
    ok: false,
    code: "portal_unavailable",
  });
  assert.equal(store.size(), 0);

  log("CAPTCHA image: rejects external URLs and creates no session");
}
}

void main().then(
  () => {
    process.stdout.write("\nAll NED connection tests passed.\n");
  },
  (error: unknown) => {
    process.stderr.write(
      `NED connection tests failed: ${
        error instanceof Error ? (error.stack ?? error.message) : String(error)
      }\n`,
    );
    process.exitCode = 1;
  },
);
