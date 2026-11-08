/**
 * Minimal cookie helpers for the NED session.
 *
 * The session cookie is HttpOnly, SameSite=Strict, path-scoped to the NED API
 * and Secure on HTTPS requests. The session ID is never returned in a JSON
 * body or a URL.
 */

export const NED_SESSION_COOKIE = "skipsafe_ned_session";
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function parseCookieHeader(
  header: string | null,
): Map<string, string> {
  const cookies = new Map<string, string>();
  if (!header) return cookies;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (name) cookies.set(name, value);
  }

  return cookies;
}

export function readNedSessionId(request: Request): string | null {
  const value = parseCookieHeader(request.headers.get("cookie")).get(
    NED_SESSION_COOKIE,
  );
  if (!value || !SESSION_ID_PATTERN.test(value)) return null;
  return value;
}

export function serializeNedSessionCookie(
  id: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  const parts = [
    `${NED_SESSION_COOKIE}=${id}`,
    "Path=/api/ned",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${Math.max(1, Math.floor(maxAgeSeconds))}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function serializeClearedNedSessionCookie(secure: boolean): string {
  const parts = [
    `${NED_SESSION_COOKIE}=`,
    "Path=/api/ned",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function isSecureRequest(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}
