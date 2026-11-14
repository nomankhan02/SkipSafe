import {
  isSecureRequest,
  readNedSessionId,
  serializeClearedNedSessionCookie,
  serializeNedSessionCookie,
} from "./cookies";
import type { NedPortalAdapter } from "./portalAdapter";
import type { NedSessionStore } from "./sessionStore";
import { validateNedCredentials } from "./validation";
import type { NedErrorCode, NedFieldName } from "./types";

/**
 * Server-only route handlers for the NED connection boundary.
 *
 * The handlers are framework-agnostic (standard Request/Response) so they can
 * be unit-tested without starting Next.js. They never log request bodies,
 * credentials, CAPTCHA answers, cookies, tokens or response contents.
 */

export const MAX_NED_REQUEST_BYTES = 8 * 1024;
export const NED_OPERATION_TIMEOUT_MS = 10_000;

type HandlerDependencies = {
  store: NedSessionStore;
  adapter: NedPortalAdapter;
  now?: () => number;
  operationTimeoutMs?: number;
};

type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; status: number };

const STATUS_BY_CODE: Record<NedErrorCode, number> = {
  invalid_request: 400,
  integration_unavailable: 503,
  invalid_credentials: 401,
  captcha_failed: 422,
  portal_unavailable: 502,
  timeout: 504,
  session_expired: 401,
  too_many_requests: 429,
  attendance_retrieval_failed: 502,
};

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Vary: "Cookie",
};

function jsonResponse(
  body: unknown,
  status: number,
  setCookie?: string,
): Response {
  const headers = new Headers(NO_STORE_HEADERS);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(JSON.stringify(body), { status, headers });
}

function isPdfBytes(value: unknown): value is Uint8Array {
  if (!(value instanceof Uint8Array) || value.byteLength < 5) return false;
  return (
    value[0] === 0x25 &&
    value[1] === 0x50 &&
    value[2] === 0x44 &&
    value[3] === 0x46 &&
    value[4] === 0x2d
  );
}

function pdfResponse(fileName: string, pdf: Uint8Array): Response {
  const headers = new Headers(NO_STORE_HEADERS);
  headers.set("Content-Type", "application/pdf");
  headers.set(
    "Content-Disposition",
    `inline; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
  );
  headers.set("X-Content-Type-Options", "nosniff");
  const body = new Uint8Array(pdf).slice().buffer;
  return new Response(body, { status: 200, headers });
}

function errorResponse(
  code: NedErrorCode,
  status = STATUS_BY_CODE[code],
  fields?: NedFieldName[],
  setCookie?: string,
): Response {
  return jsonResponse(
    fields && fields.length > 0 ? { ok: false, code, fields } : { ok: false, code },
    status,
    setCookie,
  );
}

function hasSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    return originUrl.host === requestUrl.host;
  } catch {
    return false;
  }
}

function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return contentType.split(";")[0]?.trim().toLowerCase() === "application/json";
}

async function readJsonBody(request: Request): Promise<JsonBodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_NED_REQUEST_BYTES) {
    return { ok: false, status: 413 };
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, status: 400 };
  }

  if (new TextEncoder().encode(text).byteLength > MAX_NED_REQUEST_BYTES) {
    return { ok: false, status: 413 };
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

function isSafeCaptchaImage(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 512 * 1024) return false;
  // A base64 image keeps the CAPTCHA out of third-party origins; a same-origin
  // path is allowed for adapters that proxy the image themselves.
  return (
    /^data:image\/(?:png|jpe?g|gif|webp|bmp);base64,[A-Za-z0-9+/=]+$/.test(value) ||
    /^\/api\/ned\/[A-Za-z0-9/_-]+$/.test(value)
  );
}

type TimedResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: "timeout" | "portal_unavailable" };

async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<TimedResult<T>> {
  const timeoutMarker = { timedOut: true } as const;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      operation().then((value) => ({ value }) as const),
      new Promise<typeof timeoutMarker>((resolve) => {
        timer = setTimeout(() => resolve(timeoutMarker), timeoutMs);
      }),
    ]);

    if ("timedOut" in result) {
      return { ok: false, code: "timeout" };
    }
    return { ok: true, value: result.value };
  } catch {
    return { ok: false, code: "portal_unavailable" };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function createNedHandlers({
  store,
  adapter,
  now = Date.now,
  operationTimeoutMs = NED_OPERATION_TIMEOUT_MS,
}: HandlerDependencies) {
  async function createChallenge(request: Request): Promise<Response> {
    if (!hasSameOrigin(request)) {
      return errorResponse("invalid_request", 403);
    }

    if (!adapter.isConfigured) {
      return errorResponse("integration_unavailable");
    }

    // Replacing a challenge always invalidates the previous session.
    const previousId = readNedSessionId(request);
    if (previousId) store.delete(previousId);

    const timed = await withTimeout(
      () => adapter.beginChallenge(),
      operationTimeoutMs,
    );
    if (!timed.ok) {
      return errorResponse(timed.code);
    }

    const result = timed.value;
    if (!result.ok) {
      return errorResponse(
        result.code,
        STATUS_BY_CODE[result.code],
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    if (!isSafeCaptchaImage(result.captchaImage)) {
      return errorResponse("portal_unavailable");
    }

    const created = store.create(result.portalState);
    if (!created.ok) {
      return errorResponse(created.code);
    }

    const remainingSeconds = Math.floor(
      (created.record.expiresAt - now()) / 1000,
    );
    return jsonResponse(
      {
        ok: true,
        captchaImage: result.captchaImage,
        expiresAt: created.record.expiresAt,
      },
      200,
      serializeNedSessionCookie(
        created.id,
        remainingSeconds,
        isSecureRequest(request),
      ),
    );
  }

  async function connect(request: Request): Promise<Response> {
    if (!hasSameOrigin(request)) {
      return errorResponse("invalid_request", 403);
    }
    if (!hasJsonContentType(request)) {
      return errorResponse("invalid_request", 415);
    }

    const sessionId = readNedSessionId(request);
    if (!sessionId) {
      return errorResponse(
        "session_expired",
        401,
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    const session = store.get(sessionId);
    if (!session) {
      return errorResponse(
        "session_expired",
        401,
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    const body = await readJsonBody(request);
    if (!body.ok) {
      return errorResponse("invalid_request", body.status);
    }

    const validation = validateNedCredentials(body.value);
    if (!validation.ok) {
      return errorResponse("invalid_request", 400, validation.fields);
    }

    const timed = await withTimeout(
      () =>
        adapter.authenticate({
          ...validation.value,
          portalState: session.portalState,
        }),
      operationTimeoutMs,
    );

    if (!timed.ok) {
      store.delete(sessionId);
      return errorResponse(
        timed.code,
        STATUS_BY_CODE[timed.code],
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    const result = timed.value;
    if (!result.ok) {
      store.delete(sessionId);
      return errorResponse(
        result.code,
        STATUS_BY_CODE[result.code],
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    const updated = store.markConnected(sessionId, result.portalState);
    if (!updated) {
      return errorResponse(
        "session_expired",
        401,
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    return jsonResponse(
      { ok: true, status: "connected", expiresAt: updated.expiresAt },
      200,
    );
  }

  async function fetchAttendance(request: Request): Promise<Response> {
    if (!hasSameOrigin(request)) {
      return errorResponse("invalid_request", 403);
    }

    const sessionId = readNedSessionId(request);
    if (!sessionId) {
      return errorResponse(
        "session_expired",
        401,
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    const session = store.get(sessionId);
    if (!session || session.phase !== "connected") {
      store.delete(sessionId);
      return errorResponse(
        "session_expired",
        401,
        undefined,
        serializeClearedNedSessionCookie(isSecureRequest(request)),
      );
    }

    const timed = await withTimeout(
      () => adapter.fetchAttendanceReport(session.portalState),
      operationTimeoutMs,
    );

    if (!timed.ok) {
      // Keep the session for a transient portal failure so the user can retry;
      // an expired/invalid portal session is cleared below.
      if (timed.code === "timeout") {
        return errorResponse("timeout");
      }
      return errorResponse("portal_unavailable");
    }

    const result = timed.value;
    if (!result.ok) {
      const clearSession = result.code === "session_expired";
      if (clearSession) store.delete(sessionId);
      return errorResponse(
        result.code,
        STATUS_BY_CODE[result.code],
        undefined,
        clearSession
          ? serializeClearedNedSessionCookie(isSecureRequest(request))
          : undefined,
      );
    }

    if (!isPdfBytes(result.pdf)) {
      return errorResponse("attendance_retrieval_failed");
    }

    return pdfResponse(result.fileName, result.pdf);
  }

  async function disconnect(request: Request): Promise<Response> {
    if (!hasSameOrigin(request)) {
      return errorResponse("invalid_request", 403);
    }

    const sessionId = readNedSessionId(request);
    if (sessionId) store.delete(sessionId);

    return jsonResponse(
      { ok: true },
      200,
      serializeClearedNedSessionCookie(isSecureRequest(request)),
    );
  }

  return { createChallenge, connect, fetchAttendance, disconnect };
}
