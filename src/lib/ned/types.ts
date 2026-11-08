/**
 * Shared NED connection types.
 *
 * This file is safe to import from client components: it contains no secrets,
 * no endpoint URLs and no server-only state.
 */

export const NED_ERROR_CODES = [
  "invalid_request",
  "integration_unavailable",
  "invalid_credentials",
  "captcha_failed",
  "portal_unavailable",
  "timeout",
  "session_expired",
  "too_many_requests",
  "attendance_retrieval_failed",
] as const;

export type NedErrorCode = (typeof NED_ERROR_CODES)[number];

export type NedFieldName = "studentId" | "password" | "captchaAnswer";

export type NedCredentials = {
  studentId: string;
  password: string;
  captchaAnswer: string;
};

export type NedChallengeResult =
  | {
      ok: true;
      captchaImage: string;
      expiresAt: number;
    }
  | {
      ok: false;
      code: NedErrorCode;
    };

export type NedConnectResult =
  | {
      ok: true;
      status: "connected";
      expiresAt: number;
    }
  | {
      ok: false;
      code: NedErrorCode;
      fields?: NedFieldName[];
    };

export type NedDisconnectResult = {
  ok: true;
};
