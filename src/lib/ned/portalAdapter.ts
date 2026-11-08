import type { NedErrorCode } from "./types";

/**
 * Server-only NED portal adapter boundary.
 *
 * IMPORTANT: The real NED login, CAPTCHA image and attendance-report endpoints
 * have NOT been verified. This module therefore ships a fail-closed adapter
 * that reports `integration_unavailable` and never contacts the portal.
 *
 * When the real flow is verified, implement this interface in a server-only
 * module. Contracts:
 * - Never log credentials, CAPTCHA answers, cookies, tokens, PDF bytes or
 *   extracted student data.
 * - Never put credentials inside `portalState`; it may hold only the portal
 *   session artefacts required for the next request.
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
