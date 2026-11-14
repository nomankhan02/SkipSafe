import { Buffer } from "node:buffer";
import type { NedErrorCode } from "./types";

/**
 * Server-only NED portal adapter.
 *
 * Verified against the live public portal (2026-11-09):
 * - Login page: POST https://pl.neduet.edu.pk/index.jsp
 *   fields: portal_id, pwd_portal, vericode, usertype=Undergraduate,
 *   hd_stat5=5, login.
 * - CAPTCHA image: GET https://pl.neduet.edu.pk/captchaportal, which sets an
 *   HttpOnly/Secure JSESSIONID cookie.
 * - The attendance servlet requires that authenticated JSESSIONID; without it
 *   GET /undergrad/jsp_to_pdf_servlet redirects to the login page.
 * - The portal's attendance Download link targets
 *   /undergrad/jsp_to_pdf_servlet?p=<studentId>_attendancecard.
 *
 * The authenticated PDF download itself still needs confirmation with a real
 * student account whenever the portal changes. Failure is always explicit; this
 * adapter never fabricates a PDF or turns a login page into a success.
 *
 * Contracts:
 * - Never log credentials, CAPTCHA answers, cookies, tokens, PDF bytes or
 *   extracted student data.
 * - `portalState` holds only the portal session cookie and the attendance-card
 *   identifier needed for the next request. Credentials/CAPTCHA answers are
 *   never stored there.
 * - Retrieve ONLY the attendance report.
 * - Respect portal terms, rate limits and access restrictions.
 */

export type NedBeginChallengeResult =
  | {
      ok: true;
      captchaImage: string;
      portalState: unknown;
    }
  | {
      ok: false;
      code: NedErrorCode;
    };

export type NedAuthenticateInput = {
  studentId: string;
  password: string;
  captchaAnswer: string;
  portalState: unknown;
};

export type NedAuthenticateResult =
  | {
      ok: true;
      portalState: unknown;
    }
  | {
      ok: false;
      code: NedErrorCode;
    };

export type NedAttendanceResult =
  | {
      ok: true;
      fileName: string;
      pdf: Uint8Array;
    }
  | {
      ok: false;
      code: NedErrorCode;
    };

export interface NedPortalAdapter {
  readonly id: string;
  readonly isConfigured: boolean;
  beginChallenge(): Promise<NedBeginChallengeResult>;
  authenticate(input: NedAuthenticateInput): Promise<NedAuthenticateResult>;
  fetchAttendanceReport(portalState: unknown): Promise<NedAttendanceResult>;
}

const NED_ORIGIN = "https://pl.neduet.edu.pk";
const LOGIN_PATH = "/index.jsp";
const CAPTCHA_PATH = "/captchaportal";
const ATTENDANCE_PATH = "/undergrad/jsp_to_pdf_servlet";
const SESSION_COOKIE_NAME = "JSESSIONID";
const MAX_CAPTCHA_BYTES = 512 * 1024;
const MAX_PDF_BYTES = 25 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 9_000;
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d] as const; // "%PDF-"

type FetchLike = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

type NedPortalState = {
  cookie: string;
  attendanceCard?: string;
};

export type NedDebugHopInfo = {
  method: string;
  url: string | URL;
  status?: number;
  location?: string | null;
  setCookieJSESSIONID?: boolean;
  setCookieNames?: string;
  contentType?: string | null;
  bodyClass?: string;
  bodyBytes?: number;
  response?: Response;
};

function classifyBody(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) return "empty";
  const prefix = Buffer.from(bytes.subarray(0, 5)).toString("latin1");
  if (prefix === "%PDF-") return "pdf";
  if (prefix.startsWith("<")) return "html";
  return "other";
}

function cookieNameList(headers: Headers): string {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const values =
    typeof withGetSetCookie.getSetCookie === "function"
      ? withGetSetCookie.getSetCookie()
      : [headers.get("set-cookie")].filter(
          (value): value is string => !!value,
        );

  const names = new Set<string>();
  for (const value of values) {
    for (const part of value.split(/,(?=\s*[^=;,\s]+=)/)) {
      const name = part.slice(0, part.indexOf("=")).trim();
      if (name) names.add(name);
    }
  }
  return [...names].join(",") || "none";
}

export async function debugHop(
  label: string,
  info: NedDebugHopInfo,
): Promise<void> {
  if (process.env.NED_DEBUG !== "1") {
    return;
  }

  try {
    const method = (info.method ?? "GET").toUpperCase();

    let pathname = "/";
    try {
      pathname = new URL(info.url, NED_ORIGIN).pathname;
    } catch {
      pathname = String(info.url).split("?")[0] || "/";
    }

    const response = info.response;
    const status = response ? response.status : (info.status ?? 0);

    const rawLocation = response
      ? response.headers.get("location")
      : info.location;
    let locationPathname: string | null = null;
    if (rawLocation) {
      try {
        locationPathname = new URL(rawLocation, info.url).pathname;
      } catch {
        locationPathname = String(rawLocation).split("?")[0] || null;
      }
    }

    const setCookieJSESSIONID = response
      ? extractSessionCookie(response.headers) !== null
      : Boolean(info.setCookieJSESSIONID);

    const setCookieNames = response
      ? cookieNameList(response.headers)
      : (info.setCookieNames ?? "none");

    const rawContentType = response
      ? response.headers.get("content-type")
      : info.contentType;
    const contentType = rawContentType ?? null;

    let bodyClass = info.bodyClass;
    let bodyBytes = info.bodyBytes;
    if (response) {
      try {
        const bytes = new Uint8Array(await response.clone().arrayBuffer());
        bodyClass = classifyBody(bytes);
        bodyBytes = bytes.byteLength;
      } catch {
        bodyClass = "unknown";
        bodyBytes = -1;
      }
    }

    const parts = [
      `[ned-debug] label=${label}`,
      `method=${method}`,
      `path=${pathname}`,
      `status=${status}`,
    ];
    if (locationPathname) {
      parts.push(`location=${locationPathname}`);
    }
    parts.push(`setCookieJSESSIONID=${setCookieJSESSIONID}`);
    parts.push(`setCookieNames=${setCookieNames}`);
    parts.push(`content-type=${contentType ?? "none"}`);
    parts.push(`bodyClass=${bodyClass ?? "unknown"}`);
    parts.push(`bodyBytes=${bodyBytes ?? -1}`);

    console.error(parts.join(" "));
  } catch {
    // Diagnostics must never disrupt adapter execution.
  }
}

function extractSessionCookie(headers: Headers): string | null {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies =
    typeof withGetSetCookie.getSetCookie === "function"
      ? withGetSetCookie.getSetCookie()
      : [headers.get("set-cookie")].filter((value): value is string => !!value);

  for (const header of setCookies) {
    const match = /(?:^|[,;]\s*)JSESSIONID=([^;,\s]+)/i.exec(header);
    if (match?.[1]) return `${SESSION_COOKIE_NAME}=${match[1]}`;
  }

  return null;
}

const MAX_REDIRECTS = 5;

function withCookieHeader(init: RequestInit, cookie: string): RequestInit {
  return {
    ...init,
    redirect: "manual",
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Cookie: cookie,
    },
  };
}

/**
 * Follow redirects manually so a rotated `JSESSIONID` set on a 3xx
 * response is not lost. With `redirect: "follow"`, fetch exposes only the final
 * response headers; a `Set-Cookie` on an intermediate redirect would be dropped
 * and subsequent requests would reuse a stale/anonymous portal session.
 *
 * The portal session cookie is only ever forwarded to the NED origin.
 */
async function fetchFollowingRedirects(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  initialCookie: string,
  initialLabel: string = "login POST",
): Promise<{ response: Response; cookie: string; finalUrl: string }> {
  let cookie = initialCookie;
  let currentUrl = url;
  let currentInit = withCookieHeader(init, cookie);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetchImpl(currentUrl, currentInit);

    const nextCookie = extractSessionCookie(response.headers);
    if (nextCookie) {
      cookie = nextCookie;
      currentInit = withCookieHeader(currentInit, cookie);
    }

    const location = response.headers.get("location");
    const isRedirect = response.status >= 300 && response.status < 400;

    await debugHop(hop === 0 ? initialLabel : "redirect", {
      method: currentInit.method ?? (hop === 0 ? (init.method ?? "GET") : "GET"),
      url: currentUrl,
      response,
    });

    if (!isRedirect || !location) {
      return { response, cookie, finalUrl: currentUrl };
    }

    // Drain the redirect body before issuing the next request.
    try {
      await response.body?.cancel();
    } catch {
      // A failed cancel must not block the next hop.
    }

    const nextUrl = new URL(location, currentUrl);
    if (nextUrl.origin !== NED_ORIGIN) {
      throw new Error("Redirect left the portal origin");
    }

    const method = (currentInit.method ?? "GET").toUpperCase();
    const becomesGet =
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) &&
        method === "POST");

    currentUrl = nextUrl.toString();
    if (becomesGet) {
      const headers = { ...(currentInit.headers as Record<string, string>) };
      delete headers["Content-Type"];
      delete headers["content-type"];
      currentInit = { ...currentInit, method: "GET", body: undefined, headers };
    }
  }

  throw new Error("Too many redirects");
}

const fetchLoginFollowingRedirects = fetchFollowingRedirects;

function readPortalState(value: unknown): NedPortalState | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const cookie = record.cookie;
  if (
    typeof cookie !== "string" ||
    !/^JSESSIONID=[^;,\s]+$/i.test(cookie)
  ) {
    return null;
  }

  const attendanceCard = record.attendanceCard;
  if (attendanceCard === undefined) return { cookie };
  if (
    typeof attendanceCard !== "string" ||
    attendanceCard.length === 0 ||
    attendanceCard.length > 256 ||
    /[\u0000-\u001f\u007f]/.test(attendanceCard)
  ) {
    return null;
  }

  return { cookie, attendanceCard };
}

function isPdf(bytes: Uint8Array): boolean {
  if (bytes.byteLength < PDF_MAGIC.length) return false;
  return PDF_MAGIC.every((value, index) => bytes[index] === value);
}

function isHtmlLoginForm(text: string): boolean {
  const hasPortalId = /name=["']portal_id["']/i.test(text);
  const hasPwdPortal = /name=["']pwd_portal["']/i.test(text);
  const hasVericode = /name=["']vericode["']/i.test(text);
  const hasPasswordInput = /type=["']password["']/i.test(text);
  const hasLoginFormAction = /action=["'][^"']*index\.jsp["']/i.test(text);

  return (
    hasPortalId ||
    hasPwdPortal ||
    hasLoginFormAction ||
    (hasPasswordInput && (hasVericode || /login/i.test(text)))
  );
}

function imageDataUri(contentType: string, bytes: Uint8Array): string {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() || "image/png";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

export function createNedPortalAdapter(
  fetchImpl: FetchLike = fetch,
): NedPortalAdapter {
  return {
    id: "ned-undergrad-verified",
    isConfigured: true,

    async beginChallenge(): Promise<NedBeginChallengeResult> {
      try {
        const response = await fetchImpl(`${NED_ORIGIN}${CAPTCHA_PATH}`, {
          method: "GET",
          redirect: "follow",
          cache: "no-store",
          signal: requestSignal(),
        });

        await debugHop("CAPTCHA fetch", {
          method: "GET",
          url: `${NED_ORIGIN}${CAPTCHA_PATH}`,
          response,
        });

        if (!response.ok) {
          return { ok: false, code: "portal_unavailable" };
        }

        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.toLowerCase().startsWith("image/")) {
          return { ok: false, code: "portal_unavailable" };
        }

        const cookie = extractSessionCookie(response.headers);
        if (!cookie) {
          return { ok: false, code: "portal_unavailable" };
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_CAPTCHA_BYTES) {
          return { ok: false, code: "portal_unavailable" };
        }

        return {
          ok: true,
          captchaImage: imageDataUri(contentType, bytes),
          portalState: { cookie } satisfies NedPortalState,
        };
      } catch {
        return { ok: false, code: "portal_unavailable" };
      }
    },

    async authenticate(
      input: NedAuthenticateInput,
    ): Promise<NedAuthenticateResult> {
      const state = readPortalState(input.portalState);
      if (!state) {
        return { ok: false, code: "session_expired" };
      }

      const body = new URLSearchParams({
        portal_id: input.studentId,
        pwd_portal: input.password,
        vericode: input.captchaAnswer,
        usertype: "Undergraduate",
        hd_stat5: "5",
        login: "  Login  ",
      });

      try {
        const { response, cookie: sessionCookie, finalUrl } =
          await fetchLoginFollowingRedirects(
          fetchImpl,
          `${NED_ORIGIN}${LOGIN_PATH}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              Referer: `${NED_ORIGIN}/`,
            },
            body,
            cache: "no-store",
            signal: requestSignal(),
          },
          state.cookie,
        );

        if (!response.ok) {
          return { ok: false, code: "portal_unavailable" };
        }

        // Real portal signal: a successful login redirect chain ends under
        // /undergrad/ (e.g. /undergrad/dashboard.jsp). A failed login (bad
        // credentials or wrong CAPTCHA) ends on / or /index.jsp.
        const finalPathname = new URL(finalUrl, NED_ORIGIN).pathname;
        const isLoginPage =
          finalPathname === "/" ||
          finalPathname === LOGIN_PATH ||
          finalPathname.endsWith(LOGIN_PATH);
        const isAuthenticated =
          finalPathname.startsWith("/undergrad/") && !isLoginPage;

        if (!isAuthenticated || isLoginPage) {
          return { ok: false, code: "invalid_credentials" };
        }

        const text = await response.text();

        // The portal uses this exact message for a rejected ID, password or
        // CAPTCHA answer. It does not distinguish the fields, so report the
        // attempt as rejected credentials.
        if (/please provide correct/i.test(text)) {
          return { ok: false, code: "invalid_credentials" };
        }

        // A successful login leaves index.jsp; if the login form is still
        // present the attempt did not establish an authenticated session.
        const loginFormPresent =
          /name=["']portal_id["']/i.test(text) &&
          /name=["']vericode["']/i.test(text);
        if (loginFormPresent) {
          return { ok: false, code: "invalid_credentials" };
        }

        return {
          ok: true,
          portalState: {
            cookie: sessionCookie,
            attendanceCard: `${input.studentId}_attendancecard`,
          } satisfies NedPortalState,
        };
      } catch {
        return { ok: false, code: "portal_unavailable" };
      }
    },

    async fetchAttendanceReport(
      portalState: unknown,
    ): Promise<NedAttendanceResult> {
      const state = readPortalState(portalState);
      if (!state?.attendanceCard) {
        return { ok: false, code: "session_expired" };
      }

      const url = new URL(`${NED_ORIGIN}${ATTENDANCE_PATH}`);
      url.searchParams.set("p", state.attendanceCard);

      try {
        const { response, finalUrl } = await fetchFollowingRedirects(
          fetchImpl,
          url.toString(),
          {
            method: "GET",
            headers: {
              Referer: `${NED_ORIGIN}/undergrad/`,
            },
            cache: "no-store",
            signal: requestSignal(),
          },
          state.cookie,
          "attendance request",
        );

        if (response.status === 401 || response.status === 403) {
          return { ok: false, code: "session_expired" };
        }

        if (!response.ok) {
          return { ok: false, code: "attendance_retrieval_failed" };
        }

        const lengthHeader = response.headers.get("content-length");
        if (lengthHeader) {
          const length = Number(lengthHeader);
          if (Number.isFinite(length) && length > MAX_PDF_BYTES) {
            return { ok: false, code: "attendance_retrieval_failed" };
          }
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        if (
          bytes.byteLength > MAX_PDF_BYTES ||
          bytes.byteLength === 0
        ) {
          return { ok: false, code: "attendance_retrieval_failed" };
        }

        // Check isPdf(bytes) FIRST. If the bytes start with %PDF-, return
        // success regardless of content-type.
        if (isPdf(bytes)) {
          return {
            ok: true,
            fileName: "attendance-report.pdf",
            pdf: bytes,
          };
        }

        // Only if the bytes are not a PDF: if the redirect chain ended on the
        // login page (/index.jsp) or the body is an HTML login form, return
        // session_expired; otherwise return attendance_retrieval_failed.
        const isLoginPage =
          finalUrl.endsWith(LOGIN_PATH) ||
          new URL(finalUrl, NED_ORIGIN).pathname === LOGIN_PATH;

        const bodyText = new TextDecoder().decode(bytes);
        if (isLoginPage || isHtmlLoginForm(bodyText)) {
          return { ok: false, code: "session_expired" };
        }

        return { ok: false, code: "attendance_retrieval_failed" };
      } catch {
        return { ok: false, code: "portal_unavailable" };
      }
    },
  };
}

export const nedPortalAdapter = createNedPortalAdapter();

export const unconfiguredNedAdapter: NedPortalAdapter = {
  id: "unverified",
  isConfigured: false,
  async beginChallenge() {
    return { ok: false, code: "integration_unavailable" };
  },
  async authenticate() {
    return { ok: false, code: "integration_unavailable" };
  },
  async fetchAttendanceReport() {
    return { ok: false, code: "integration_unavailable" };
  },
};
