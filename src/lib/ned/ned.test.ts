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
import {
  createNedPortalAdapter,
  debugHop,
  unconfiguredNedAdapter,
} from "./portalAdapter";
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
  attendanceResult?:
    | { ok: true; fileName: string; pdf: Uint8Array }
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
      return (
        options.attendanceResult ?? {
          ok: true,
          fileName: "attendance-report.pdf",
          pdf: new TextEncoder().encode("%PDF-1.7 fake test bytes"),
        }
      );
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

// ─────────────────────────────────────────────────────────────────────────────
// 5. Verified portal adapter contract (fake transport, no real credentials)
// ─────────────────────────────────────────────────────────────────────────────

{
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const pdfBytes = new TextEncoder().encode("%PDF-1.7 test attendance");

  const fakeFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requests.push({ url, init });

    if (url === "https://pl.neduet.edu.pk/captchaportal") {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=test-session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url === "https://pl.neduet.edu.pk/index.jsp") {
      return new Response(null, {
        status: 302,
        headers: {
          location: "/undergrad/dashboard.jsp",
        },
      });
    }

    if (url === "https://pl.neduet.edu.pk/undergrad/dashboard.jsp") {
      return new Response("<html><body>Portal dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.startsWith("https://pl.neduet.edu.pk/undergrad/jsp_to_pdf_servlet")) {
      return new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(fakeFetch);
  const challenge = await adapter.beginChallenge();
  assert.equal(challenge.ok, true, "challenge should succeed");
  if (!challenge.ok) throw new Error("challenge failed");
  assert.match(challenge.captchaImage, /^data:image\/png;base64,/);
  assert.equal(JSON.stringify(challenge.portalState).includes("test-session"), true);

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  assert.equal(authenticated.ok, true, "login should succeed");
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.equal(attendance.ok, true, "attendance retrieval should succeed");
  if (attendance.ok) {
    assert.equal(
      new TextDecoder().decode(attendance.pdf),
      "%PDF-1.7 test attendance",
    );
    assert.equal(attendance.fileName.endsWith(".pdf"), true);
  }

  const loginRequest = requests.find((request) =>
    request.url.endsWith("/index.jsp"),
  );
  assert.ok(loginRequest, "adapter must POST to the verified login endpoint");
  const loginBody = loginRequest.init?.body as URLSearchParams;
  assert.equal(loginBody.get("portal_id"), "SE-2026-001");
  assert.equal(loginBody.get("pwd_portal"), "temporary-password");
  assert.equal(loginBody.get("vericode"), "AbC12");
  assert.equal(loginBody.get("usertype"), "Undergraduate");
  assert.equal(loginBody.get("hd_stat5"), "5");
  const loginHeaders = loginRequest.init?.headers as Record<string, string>;
  assert.equal(loginHeaders.Cookie, "JSESSIONID=test-session");

  const pdfRequest = requests.find((request) =>
    request.url.includes("/undergrad/jsp_to_pdf_servlet"),
  );
  assert.ok(pdfRequest, "adapter must fetch the attendance servlet");
  assert.match(
    pdfRequest.url,
    /[?&]p=SE-2026-001_attendancecard(?:&|$)/,
  );
  assert.equal(
    (pdfRequest.init?.headers as Record<string, string>).Cookie,
    "JSESSIONID=test-session",
  );

  log("adapter: verified login/CAPTCHA/attendance endpoints, cookie reuse, card id");
}

{
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const pdfBytes = new TextEncoder().encode("%PDF-1.7 rotated cookie test");
  const rotatedCookie = "JSESSIONID=rotated-after-login";

  const fakeFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requests.push({ url, init });
    const headers = (init?.headers ?? {}) as Record<string, string>;

    if (url === "https://pl.neduet.edu.pk/captchaportal") {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=pre-login; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url === "https://pl.neduet.edu.pk/index.jsp") {
      if (init?.redirect !== "manual") {
        // Emulate fetch's automatic redirect handling: the intermediate 3xx
        // Set-Cookie is not exposed and the final anonymous page supplies a
        // replacement cookie. This is what the adapter must avoid.
        return new Response("<html><body>Login</body></html>", {
          status: 200,
          headers: {
            "content-type": "text/html",
            "set-cookie": "JSESSIONID=anonymous; Path=/; HttpOnly",
          },
        });
      }
      // A successful login redirects and rotates the portal session. The new
      // JSESSIONID is only present on this 3xx response.
      return new Response(null, {
        status: 302,
        headers: {
          location: "/undergrad/MainMenu.jsp",
          "set-cookie": `${rotatedCookie}; Path=/; HttpOnly; Secure`,
        },
      });
    }

    if (url === "https://pl.neduet.edu.pk/undergrad/MainMenu.jsp") {
      if (headers.Cookie !== rotatedCookie) {
        // Without the rotated cookie the portal treats the request as a brand
        // new anonymous session and issues yet another JSESSIONID.
        return new Response("<html><body>Login</body></html>", {
          status: 200,
          headers: {
            "content-type": "text/html",
            "set-cookie": "JSESSIONID=anonymous; Path=/; HttpOnly",
          },
        });
      }
      return new Response("<html><body>Dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.startsWith("https://pl.neduet.edu.pk/undergrad/jsp_to_pdf_servlet")) {
      if (headers.Cookie !== rotatedCookie) {
        // An unauthenticated attendance request gets an HTML page, which the
        // adapter correctly reports as an expired session.
        return new Response("<html><body>Login</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }
      return new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(fakeFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  assert.equal(
    authenticated.ok,
    true,
    "login redirect must be followed manually and remain successful",
  );
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.equal(attendance.ok, true, "attendance should use the rotated cookie");

  const loginRequest = requests.find((request) =>
    request.url.endsWith("/index.jsp"),
  );
  assert.equal(
    loginRequest?.init?.redirect,
    "manual",
    "login must not let fetch drop redirect Set-Cookie headers",
  );

  const dashboardRequest = requests.find((request) =>
    request.url.endsWith("/undergrad/MainMenu.jsp"),
  );
  assert.equal(
    (dashboardRequest?.init?.headers as Record<string, string> | undefined)
      ?.Cookie,
    rotatedCookie,
    "the rotated cookie must be used for the redirect target",
  );

  const pdfRequest = requests.find((request) =>
    request.url.includes("/undergrad/jsp_to_pdf_servlet"),
  );
  assert.equal(
    (pdfRequest?.init?.headers as Record<string, string> | undefined)?.Cookie,
    rotatedCookie,
    "attendance must not reuse the stale or anonymous cookie",
  );

  log("adapter: redirect-set JSESSIONID is preserved for attendance retrieval");
}

{
  const rejectingFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=reject-session; Path=/; HttpOnly; Secure",
        },
      });
    }
    if (url.endsWith("/index.jsp")) {
      return new Response(
        "<html><body>Please provide correct values for all fields</body></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(rejectingFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");
  const result = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "wrong",
    captchaAnswer: "wrong",
    portalState: challenge.portalState,
  });
  assert.deepEqual(result, { ok: false, code: "invalid_credentials" });

  log("adapter: portal rejection message maps to invalid_credentials");
}

{
  const htmlForPdfFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=expired-session; Path=/; HttpOnly; Secure",
        },
      });
    }
    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }
    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response(
      '<html><body><form action="index.jsp" method="POST"><input name="portal_id"><input name="pwd_portal" type="password"></form></body></html>',
      {
        status: 200,
        headers: { "content-type": "text/html" },
      },
    );
  };

  const adapter = createNedPortalAdapter(htmlForPdfFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");
  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.deepEqual(attendance, { ok: false, code: "session_expired" });

  log("adapter: HTML login response is never treated as a PDF");
}

{
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const redirectFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requests.push({ url, init });

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=test-session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      if (init?.method === "POST") {
        return new Response(null, {
          status: 302,
          headers: { location: "/undergrad/dashboard.jsp" },
        });
      }
      return new Response("<html><body>Login Form</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Portal dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "/index.jsp",
        },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(redirectFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.deepEqual(attendance, { ok: false, code: "session_expired" });

  const attendanceHop = requests.find((req) =>
    req.url.includes("/undergrad/jsp_to_pdf_servlet"),
  );
  assert.ok(attendanceHop, "initial attendance request must be made");
  assert.equal(
    attendanceHop.init?.redirect,
    "manual",
    "attendance request must use redirect: manual",
  );

  const redirectHop = requests.find(
    (req) => req.url.endsWith("/index.jsp") && req.init?.method === "GET",
  );
  assert.ok(
    redirectHop,
    "attendance request must follow redirect to the login page",
  );

  log("adapter: attendance redirect to login page maps to session_expired");
}

{
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const initialSessionCookie = "JSESSIONID=authenticated-session-1";
  const rotatedAttendanceCookie = "JSESSIONID=attendance-rotated-session-2";
  const pdfBytes = new TextEncoder().encode("%PDF-1.7 attendance report after redirect");

  const rotatedAttendanceFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requests.push({ url, init });
    const headers = (init?.headers ?? {}) as Record<string, string>;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": `${initialSessionCookie}; Path=/; HttpOnly; Secure`,
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }

    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Portal dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      // First attendance hop: redirect with rotated cookie
      if (!url.includes("step=2")) {
        return new Response(null, {
          status: 302,
          headers: {
            location: "/undergrad/jsp_to_pdf_servlet?p=SE-2026-001_attendancecard&step=2",
            "set-cookie": `${rotatedAttendanceCookie}; Path=/; HttpOnly; Secure`,
          },
        });
      }

      // Second attendance hop: must forward rotated cookie
      if (headers.Cookie !== rotatedAttendanceCookie) {
        return new Response("<html><body>Session Expired / Wrong Cookie</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }

      return new Response(pdfBytes, {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(rotatedAttendanceFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.equal(attendance.ok, true, "attendance should succeed after rotated cookie");
  if (attendance.ok) {
    assert.equal(attendance.fileName, "attendance-report.pdf");
    assert.equal(
      new TextDecoder().decode(attendance.pdf),
      "%PDF-1.7 attendance report after redirect",
    );
  }

  const secondHop = requests.find((req) => req.url.includes("step=2"));
  assert.ok(secondHop, "must have followed redirect to second hop");
  const secondHopHeaders = (secondHop.init?.headers ?? {}) as Record<string, string>;
  assert.equal(
    secondHopHeaders.Cookie,
    rotatedAttendanceCookie,
    "second hop must forward the rotated cookie",
  );

  log("adapter: attendance retrieval succeeds after following redirect with rotated cookie");
}

{
  let redirectCount = 0;
  const loopFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }
    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      redirectCount++;
      return new Response(null, {
        status: 302,
        headers: {
          location: `/undergrad/jsp_to_pdf_servlet?p=SE-2026-001_attendancecard&hop=${redirectCount}`,
        },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(loopFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.deepEqual(attendance, { ok: false, code: "portal_unavailable" });
  assert.equal(
    redirectCount,
    6,
    "attendance redirect chain must be capped at 5 redirects (6 hops total)",
  );

  log("adapter: attendance redirect chain capped at 5 redirects");
}

{
  const crossOriginFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }
    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "https://evil.example/attendance.pdf",
        },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(crossOriginFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.deepEqual(attendance, { ok: false, code: "portal_unavailable" });

  log("adapter: attendance cross-origin redirect is rejected");
}

{
  const htmlContentTypePdfFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=test-session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }

    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Portal dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      // Real-portal behavior: servlet returns content-type text/html;charset=windows-1252 but body is a valid PDF
      return new Response(new TextEncoder().encode("%PDF-1.7 actual attendance report bytes"), {
        status: 200,
        headers: { "content-type": "text/html;charset=windows-1252" },
      });
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(htmlContentTypePdfFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.equal(attendance.ok, true, "valid PDF with text/html content-type must succeed");
  if (attendance.ok) {
    assert.equal(attendance.fileName, "attendance-report.pdf");
    assert.equal(
      new TextDecoder().decode(attendance.pdf),
      "%PDF-1.7 actual attendance report bytes",
    );
  }

  log("adapter: 200 response with content-type text/html starting with %PDF- returns the PDF");
}

{
  const realHtmlLoginFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=test-session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }

    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Portal dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      // Non-PDF response containing an actual HTML login form
      return new Response(
        '<html><body><form action="index.jsp" method="POST"><input name="portal_id"><input name="pwd_portal" type="password"><input name="vericode"></form></body></html>',
        {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        },
      );
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(realHtmlLoginFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.deepEqual(
    attendance,
    { ok: false, code: "session_expired" },
    "real HTML login page must return session_expired",
  );

  log("adapter: real HTML login page returns session_expired");
}

{
  const htmlErrorFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=test-session; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: { location: "/undergrad/dashboard.jsp" },
      });
    }
    if (url.includes("/undergrad/dashboard.jsp")) {
      return new Response("<html><body>Dashboard</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }

    if (url.includes("/undergrad/jsp_to_pdf_servlet")) {
      // HTML error page that is NOT a login form
      return new Response(
        "<html><body><h1>500 Internal Server Error</h1><p>Database query failed for attendance card.</p></body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        },
      );
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(htmlErrorFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const authenticated = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "temporary-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });
  if (!authenticated.ok) throw new Error("authentication failed");

  const attendance = await adapter.fetchAttendanceReport(
    authenticated.portalState,
  );
  assert.deepEqual(
    attendance,
    { ok: false, code: "attendance_retrieval_failed" },
    "HTML non-login error page must return attendance_retrieval_failed",
  );

  log("adapter: HTML non-login error page returns attendance_retrieval_failed");
}

{
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const goodLoginFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    requests.push({ url, init });

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=session-good; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "/undergrad/dashboard.jsp",
          "set-cookie": "JSESSIONID=session-auth; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/undergrad/dashboard.jsp")) {
      return new Response(
        "<html><body>Welcome to NED Undergrad Dashboard</body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(goodLoginFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const auth = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "correct-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });

  assert.equal(auth.ok, true, "login ending on /undergrad/dashboard.jsp must succeed");
  if (auth.ok) {
    assert.deepEqual(auth.portalState, {
      cookie: "JSESSIONID=session-auth",
      attendanceCard: "SE-2026-001_attendancecard",
    });
  }

  log("adapter: good login redirect chain ending on /undergrad/dashboard.jsp succeeds");
}

{
  const failedLoginFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=session-fail; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      // Real-portal behavior on failed login: redirects back to / (login page)
      return new Response(null, {
        status: 302,
        headers: {
          location: "/",
        },
      });
    }

    if (new URL(url).pathname === "/") {
      return new Response(
        "<html><body>Login page with error notification</body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(failedLoginFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const auth = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "bad-password",
    captchaAnswer: "wrong-captcha",
    portalState: challenge.portalState,
  });

  assert.deepEqual(
    auth,
    { ok: false, code: "invalid_credentials" },
    "failed login ending on / must map to invalid_credentials",
  );

  log("adapter: failed login redirect chain ending on / maps to invalid_credentials");
}

{
  const anonymousPageFetch = async (
    input: RequestInfo | URL,
  ): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    if (url.endsWith("/captchaportal")) {
      return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        status: 200,
        headers: {
          "content-type": "image/png",
          "set-cookie": "JSESSIONID=session-anon; Path=/; HttpOnly; Secure",
        },
      });
    }

    if (url.endsWith("/index.jsp")) {
      return new Response(null, {
        status: 302,
        headers: {
          location: "/portal_help.jsp",
        },
      });
    }

    if (url.endsWith("/portal_help.jsp")) {
      // Public / anonymous page: has no login form elements (no portal_id or vericode inputs)
      return new Response(
        "<html><body><h1>Portal Help & Instructions</h1><p>Please contact IT for support.</p></body></html>",
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }

    return new Response("missing", { status: 404 });
  };

  const adapter = createNedPortalAdapter(anonymousPageFetch);
  const challenge = await adapter.beginChallenge();
  if (!challenge.ok) throw new Error("challenge failed");

  const auth = await adapter.authenticate({
    studentId: "SE-2026-001",
    password: "any-password",
    captchaAnswer: "AbC12",
    portalState: challenge.portalState,
  });

  assert.deepEqual(
    auth,
    { ok: false, code: "invalid_credentials" },
    "landing on an anonymous page not under /undergrad/ must return invalid_credentials",
  );

  log("adapter: anonymous page with no login form not under /undergrad/ maps to invalid_credentials");
}

{
  const clock = 60_000;
  const store = createNedSessionStore({ now: () => clock });
  const fake = createFakeAdapter();
  const handlers = createNedHandlers({
    store,
    adapter: fake.adapter,
    now: () => clock,
  });

  const noSession = await handlers.fetchAttendance(
    makeRequest("/api/ned/session/attendance"),
  );
  assert.equal(noSession.status, 401);
  assert.deepEqual(await json(noSession), {
    ok: false,
    code: "session_expired",
  });
  assert.match(noSession.headers.get("set-cookie") ?? "", /Max-Age=0/);

  const challenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const cookie = setCookie(challenge);
  assert.ok(cookie);

  const beforeConnect = await handlers.fetchAttendance(
    makeRequest("/api/ned/session/attendance", { cookie }),
  );
  assert.equal(beforeConnect.status, 401);
  assert.equal(store.size(), 0, "challenge-only sessions cannot fetch attendance");

  const secondChallenge = await handlers.createChallenge(
    makeRequest("/api/ned/session/challenge"),
  );
  const secondCookie = setCookie(secondChallenge);
  assert.ok(secondCookie);
  const connected = await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie: secondCookie,
      body: {
        studentId: "SE-2026-001",
        password: "temporary-password",
        captchaAnswer: "AbC12",
      },
    }),
  );
  assert.equal(connected.status, 200);

  const pdf = await handlers.fetchAttendance(
    makeRequest("/api/ned/session/attendance", { cookie: secondCookie }),
  );
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get("content-type") ?? "", /application\/pdf/);
  assert.match(pdf.headers.get("cache-control") ?? "", /no-store/i);
  assert.equal(pdf.headers.get("x-content-type-options"), "nosniff");
  const pdfBytes = new Uint8Array(await pdf.arrayBuffer());
  assert.equal(new TextDecoder().decode(pdfBytes.slice(0, 5)), "%PDF-");
  assert.equal(store.size(), 1, "successful retrieval keeps the TTL session");

  log("handlers: attendance requires a connected session and returns a PDF");
}

{
  const clock = 70_000;
  const store = createNedSessionStore({ now: () => clock });
  const fake = createFakeAdapter({
    attendanceResult: { ok: false, code: "session_expired" },
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
  await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: {
        studentId: "SE-2026-001",
        password: "temporary-password",
        captchaAnswer: "AbC12",
      },
    }),
  );

  const expired = await handlers.fetchAttendance(
    makeRequest("/api/ned/session/attendance", { cookie }),
  );
  assert.equal(expired.status, 401);
  assert.deepEqual(await json(expired), {
    ok: false,
    code: "session_expired",
  });
  assert.match(expired.headers.get("set-cookie") ?? "", /Max-Age=0/);
  assert.equal(store.size(), 0, "expired portal session must be deleted");

  log("handlers: expired portal session is cleared and reported as session_expired");
}

{
  const clock = 80_000;
  const store = createNedSessionStore({ now: () => clock });
  const fake = createFakeAdapter({
    attendanceResult: {
      ok: true,
      fileName: "attendance-report.pdf",
      pdf: new TextEncoder().encode("not a pdf"),
    },
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
  await handlers.connect(
    makeRequest("/api/ned/session/connect", {
      cookie,
      body: {
        studentId: "SE-2026-001",
        password: "temporary-password",
        captchaAnswer: "AbC12",
      },
    }),
  );

  const invalid = await handlers.fetchAttendance(
    makeRequest("/api/ned/session/attendance", { cookie }),
  );
  assert.equal(invalid.status, 502);
  assert.deepEqual(await json(invalid), {
    ok: false,
    code: "attendance_retrieval_failed",
  });
  assert.equal(store.size(), 1, "invalid PDF does not destroy a usable session");

  log("handlers: non-PDF response maps to attendance_retrieval_failed");
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Opt-in diagnostics (NED_DEBUG): safe logging without credential leakage
// ─────────────────────────────────────────────────────────────────────────────

{
  const originalDebug = process.env.NED_DEBUG;
  const originalConsoleError = console.error;
  const logs: string[] = [];

  const spyConsoleError = (...args: unknown[]): void => {
    logs.push(
      args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
        .join(" "),
    );
  };

  try {
    console.error = spyConsoleError;

    // A. Direct debugHop: only logs when NED_DEBUG === "1"
    process.env.NED_DEBUG = "0";
    await debugHop("disabled-hop", {
      method: "GET",
      url: "https://pl.neduet.edu.pk/test",
      status: 200,
      setCookieJSESSIONID: false,
      contentType: "text/plain",
      bodyClass: "other",
      bodyBytes: 5,
    });
    assert.equal(logs.length, 0, "debugHop must be silent when NED_DEBUG !== '1'");

    process.env.NED_DEBUG = "1";
    await debugHop("unit-test", {
      method: "POST",
      url: "https://pl.neduet.edu.pk/undergrad/jsp_to_pdf_servlet?p=SE-2026-999-SECRET-ID_attendancecard&leak=url-secret",
      status: 302,
      location: "/undergrad/MainMenu.jsp?token=location-secret-token",
      setCookieJSESSIONID: true,
      contentType: "text/html; charset=UTF-8",
      bodyClass: "html",
      bodyBytes: 80,
      setCookieNames: "JSESSIONID",
    });

    assert.equal(logs.length, 1);
    const unitHopLog = logs[0];
    assert.match(unitHopLog, /^\[ned-debug\] label=unit-test/);
    assert.match(unitHopLog, /\bmethod=POST\b/);
    assert.match(unitHopLog, /\bpath=\/undergrad\/jsp_to_pdf_servlet\b/);
    assert.match(unitHopLog, /\bstatus=302\b/);
    assert.match(unitHopLog, /\blocation=\/undergrad\/MainMenu\.jsp\b/);
    assert.match(unitHopLog, /\bsetCookieJSESSIONID=true\b/);
    assert.match(unitHopLog, /\bcontent-type=text\/html; charset=UTF-8\b/);
    assert.equal(unitHopLog.includes("bodyClass=html"), true);

    // Negative assertions for direct debugHop
    assert.equal(unitHopLog.includes("SE-2026-999-SECRET-ID"), false);
    assert.equal(unitHopLog.includes("url-secret"), false);
    assert.equal(unitHopLog.includes("location-secret-token"), false);
    assert.equal(unitHopLog.includes("SECRET-PASSWORD"), false);
    assert.equal(unitHopLog.includes("Welcome"), false);

    logs.length = 0;

    // B. Full adapter flow: CAPTCHA fetch, login POST, manual redirect, attendance request
    const studentId = "SE-2026-STUDENT-SECRET-42";
    const password = "TOP-SECRET-PASSWORD-XYZ";
    const captchaAnswer = "CAPTCHA-ANSWER-999";
    const preLoginCookie = "pre-login-cookie-secret-111";
    const rotatedCookie = "rotated-cookie-secret-222";
    const locationQuerySecret = "redirect-location-token-333";
    const dashboardHtmlSecret = "dashboard-sensitive-content-444";
    const pdfBytesSecret = "pdf-sensitive-stream-content-555";

    const diagnosticFetch = async (
      input: RequestInfo | URL,
    ): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === "https://pl.neduet.edu.pk/captchaportal") {
        return new Response(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]), {
          status: 200,
          headers: {
            "content-type": "image/png",
            "set-cookie": `JSESSIONID=${preLoginCookie}; Path=/; HttpOnly; Secure`,
          },
        });
      }

      if (url === "https://pl.neduet.edu.pk/index.jsp") {
        return new Response("<html><body>Redirecting...</body></html>", {
          status: 302,
          headers: {
            location: `/undergrad/MainMenu.jsp?token=${locationQuerySecret}`,
            "set-cookie": `JSESSIONID=${rotatedCookie}; Path=/; HttpOnly; Secure`,
            "content-type": "text/html",
          },
        });
      }

      if (url.startsWith("https://pl.neduet.edu.pk/undergrad/MainMenu.jsp")) {
        return new Response(
          `<html><body>Dashboard for ${studentId}: ${dashboardHtmlSecret}</body></html>`,
          {
            status: 200,
            headers: { "content-type": "text/html" },
          },
        );
      }

      if (url.startsWith("https://pl.neduet.edu.pk/undergrad/jsp_to_pdf_servlet")) {
        return new Response(
          new TextEncoder().encode(`%PDF-1.7 ${pdfBytesSecret}`),
          {
            status: 200,
            headers: { "content-type": "application/pdf" },
          },
        );
      }

      return new Response("not found", { status: 404 });
    };

    const adapter = createNedPortalAdapter(diagnosticFetch);

    // 1. CAPTCHA fetch hop
    const challenge = await adapter.beginChallenge();
    assert.equal(challenge.ok, true);
    if (!challenge.ok) throw new Error("challenge failed");

    // 2. Login POST and 3. Manual redirect hops
    const auth = await adapter.authenticate({
      studentId,
      password,
      captchaAnswer,
      portalState: challenge.portalState,
    });
    assert.equal(auth.ok, true);
    if (!auth.ok) throw new Error("auth failed");

    // 4. Attendance request hop
    const attendance = await adapter.fetchAttendanceReport(auth.portalState);
    assert.equal(attendance.ok, true);

    // Verify exactly 4 hops were logged
    assert.equal(logs.length, 4, "expected exactly 4 hops to be logged");

    const [captchaLog, loginPostLog, redirectLog, attendanceLog] = logs;

    // Hop 1: CAPTCHA fetch
    assert.match(captchaLog, /label=CAPTCHA fetch/);
    assert.match(captchaLog, /\bmethod=GET\b/);
    assert.match(captchaLog, /\bpath=\/captchaportal\b/);
    assert.match(captchaLog, /\bstatus=200\b/);
    assert.match(captchaLog, /\bsetCookieJSESSIONID=true\b/);
    assert.match(captchaLog, /\bcontent-type=image\/png\b/);

    // Hop 2: login POST
    assert.match(loginPostLog, /label=login POST/);
    assert.match(loginPostLog, /\bmethod=POST\b/);
    assert.match(loginPostLog, /\bpath=\/index\.jsp\b/);
    assert.match(loginPostLog, /\bstatus=302\b/);
    assert.match(loginPostLog, /\blocation=\/undergrad\/MainMenu\.jsp\b/);
    assert.match(loginPostLog, /\bsetCookieJSESSIONID=true\b/);
    assert.match(loginPostLog, /\bcontent-type=text\/html\b/);

    // Hop 3: manual redirect
    assert.match(redirectLog, /label=redirect/);
    assert.match(redirectLog, /\bmethod=GET\b/);
    assert.match(redirectLog, /\bpath=\/undergrad\/MainMenu\.jsp\b/);
    assert.match(redirectLog, /\bstatus=200\b/);
    assert.match(redirectLog, /\bsetCookieJSESSIONID=false\b/);
    assert.match(redirectLog, /\bcontent-type=text\/html\b/);

    // Hop 4: attendance request
    assert.match(attendanceLog, /label=attendance request/);
    assert.match(attendanceLog, /\bmethod=GET\b/);
    assert.match(attendanceLog, /\bpath=\/undergrad\/jsp_to_pdf_servlet\b/);
    assert.match(attendanceLog, /\bstatus=200\b/);
    assert.match(attendanceLog, /\bsetCookieJSESSIONID=false\b/);
    assert.match(attendanceLog, /\bcontent-type=application\/pdf\b/);
    assert.equal(attendanceLog.includes("bodyClass=pdf"), true);

    // Critical privacy assertions: all logs combined must contain NO sensitive data
    const combinedLogs = logs.join("\n");
    assert.equal(
      combinedLogs.includes(studentId),
      false,
      "student ID must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(password),
      false,
      "password must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(captchaAnswer),
      false,
      "CAPTCHA answer must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(preLoginCookie),
      false,
      "pre-login cookie value must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(rotatedCookie),
      false,
      "rotated cookie value must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(locationQuerySecret),
      false,
      "location query string must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(dashboardHtmlSecret),
      false,
      "response body beyond 5 chars must never appear in debug logs",
    );
    assert.equal(
      combinedLogs.includes(pdfBytesSecret),
      false,
      "PDF body beyond 5 chars must never appear in debug logs",
    );

    // C. Verify silence when NED_DEBUG is disabled
    logs.length = 0;
    delete process.env.NED_DEBUG;
    await adapter.beginChallenge();
    assert.equal(logs.length, 0, "must produce no logs when NED_DEBUG is unset");
  } finally {
    console.error = originalConsoleError;
    if (originalDebug === undefined) {
      delete process.env.NED_DEBUG;
    } else {
      process.env.NED_DEBUG = originalDebug;
    }
  }

  log("debugHop: opt-in diagnostics contain no cookie value, password, or student ID");
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
