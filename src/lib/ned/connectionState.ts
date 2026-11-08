import type { NedErrorCode, NedFieldName } from "./types";

export type NedUiStatus =
  | "idle"
  | "loading_captcha"
  | "ready"
  | "connecting"
  | "connected"
  | "error";

export type NedUiState = {
  status: NedUiStatus;
  message: string;
  captchaImage: string | null;
  expiresAt: number | null;
  fields: NedFieldName[];
};

export const NED_ERROR_MESSAGES: Record<NedErrorCode, string> = {
  invalid_request: "Check your student ID, password and CAPTCHA answer.",
  integration_unavailable:
    "NED integration is not configured or verified yet. Nothing was sent to NED.",
  invalid_credentials:
    "NED rejected these credentials. Nothing was stored. Check and try again.",
  captcha_failed:
    "NED rejected the CAPTCHA answer. Load a new CAPTCHA and try again.",
  portal_unavailable:
    "The NED portal could not be reached. Try again later.",
  timeout: "The NED portal did not respond in time. Try again.",
  session_expired: "The temporary session expired. Load a new CAPTCHA.",
  too_many_requests:
    "Too many connection attempts. Wait a moment and try again.",
  attendance_retrieval_failed:
    "Connected, but the attendance report could not be retrieved.",
};

export const initialNedUiState: NedUiState = {
  status: "idle",
  message:
    "Load a CAPTCHA to start. Live NED authentication is not enabled yet.",
  captchaImage: null,
  expiresAt: null,
  fields: [],
};

export function nedErrorState(
  code: NedErrorCode,
  fields: NedFieldName[] = [],
): NedUiState {
  return {
    status: "error",
    message: NED_ERROR_MESSAGES[code],
    captchaImage: null,
    expiresAt: null,
    fields,
  };
}

export function nedLoadingCaptchaState(): NedUiState {
  return {
    status: "loading_captcha",
    message: "Requesting a CAPTCHA…",
    captchaImage: null,
    expiresAt: null,
    fields: [],
  };
}

export function nedReadyState(
  captchaImage: string,
  expiresAt: number,
): NedUiState {
  return {
    status: "ready",
    message:
      "CAPTCHA loaded. Solve it manually and connect. The session expires automatically.",
    captchaImage,
    expiresAt,
    fields: [],
  };
}

export function nedConnectingState(current: NedUiState): NedUiState {
  return {
    ...current,
    status: "connecting",
    message: "Connecting to NED…",
    fields: [],
  };
}

export function nedConnectedState(expiresAt: number): NedUiState {
  return {
    status: "connected",
    message:
      "Connection verified. Attendance retrieval will be enabled after the full verified NED flow is implemented.",
    captchaImage: null,
    expiresAt,
    fields: [],
  };
}
