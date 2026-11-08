import type { NedCredentials, NedFieldName } from "./types";

/**
 * Permissive input validation.
 *
 * SkipSafe does not invent a NED student-ID format. The server only enforces
 * presence, sane length limits and control-character rejection so the real
 * portal can define its own format later. Error messages never echo values.
 */

export const MAX_STUDENT_ID_LENGTH = 64;
export const MAX_PASSWORD_LENGTH = 256;
export const MAX_CAPTCHA_ANSWER_LENGTH = 32;

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export type NedValidationResult =
  | { ok: true; value: NedCredentials }
  | { ok: false; fields: NedFieldName[] };

export const NED_FIELD_MESSAGES: Record<NedFieldName, string> = {
  studentId: "Enter your NED student ID.",
  password: "Enter your NED password.",
  captchaAnswer: "Enter the characters shown in the CAPTCHA.",
};

function readString(
  record: Record<string, unknown>,
  key: NedFieldName,
  trim: boolean,
): string {
  const value = record[key];
  if (typeof value !== "string") return "";
  return trim ? value.trim() : value;
}

export function validateNedCredentials(input: unknown): NedValidationResult {
  const record =
    typeof input === "object" && input !== null
      ? (input as Record<string, unknown>)
      : {};

  const studentId = readString(record, "studentId", true);
  const password = readString(record, "password", false);
  const captchaAnswer = readString(record, "captchaAnswer", true);
  const fields: NedFieldName[] = [];

  if (
    studentId.length === 0 ||
    studentId.length > MAX_STUDENT_ID_LENGTH ||
    CONTROL_CHARACTERS.test(studentId)
  ) {
    fields.push("studentId");
  }

  if (
    password.length === 0 ||
    password.length > MAX_PASSWORD_LENGTH ||
    CONTROL_CHARACTERS.test(password)
  ) {
    fields.push("password");
  }

  if (
    captchaAnswer.length === 0 ||
    captchaAnswer.length > MAX_CAPTCHA_ANSWER_LENGTH ||
    CONTROL_CHARACTERS.test(captchaAnswer)
  ) {
    fields.push("captchaAnswer");
  }

  if (fields.length > 0) {
    return { ok: false, fields };
  }

  return {
    ok: true,
    value: { studentId, password, captchaAnswer },
  };
}
