"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  initialNedUiState,
  nedConnectedState,
  nedConnectingState,
  nedErrorState,
  nedLoadingCaptchaState,
  nedReadyState,
  type NedUiState,
} from "@/lib/ned/connectionState";
import {
  NED_FIELD_MESSAGES,
  validateNedCredentials,
} from "@/lib/ned/validation";
import type {
  NedChallengeResult,
  NedConnectResult,
  NedErrorCode,
  NedFieldName,
} from "@/lib/ned/types";

type FieldErrors = Partial<Record<NedFieldName, string>>;

function isNedErrorCode(value: unknown): value is NedErrorCode {
  return (
    value === "invalid_request" ||
    value === "integration_unavailable" ||
    value === "invalid_credentials" ||
    value === "captcha_failed" ||
    value === "portal_unavailable" ||
    value === "timeout" ||
    value === "session_expired" ||
    value === "too_many_requests" ||
    value === "attendance_retrieval_failed"
  );
}

function readErrorCode(value: unknown): NedErrorCode {
  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    isNedErrorCode(value.code)
  ) {
    return value.code;
  }
  return "portal_unavailable";
}

function readFields(value: unknown): NedFieldName[] {
  if (
    typeof value !== "object" ||
    value === null ||
    !("fields" in value) ||
    !Array.isArray(value.fields)
  ) {
    return [];
  }
  return value.fields.filter(
    (field): field is NedFieldName =>
      field === "studentId" ||
      field === "password" ||
      field === "captchaAnswer",
  );
}

async function requestChallenge(): Promise<unknown> {
  const response = await fetch("/api/ned/session/challenge", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(15_000),
  });
  return response.json().catch(() => null);
}

async function requestConnect(body: unknown): Promise<unknown> {
  const response = await fetch("/api/ned/session/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(15_000),
  });
  return response.json().catch(() => null);
}

export function NedConnection() {
  const [state, setState] = useState<NedUiState>(initialNedUiState);
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const sessionActiveRef = useRef(false);

  const busy =
    state.status === "loading_captcha" || state.status === "connecting";
  const connected = state.status === "connected";

  const clearSecretFields = useCallback(() => {
    setStudentId("");
    setPassword("");
    setCaptchaAnswer("");
  }, []);

  useEffect(() => {
    const handlePageHide = () => {
      if (!sessionActiveRef.current) return;
      sessionActiveRef.current = false;
      void fetch("/api/ned/session", {
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
        keepalive: true,
      }).catch(() => {
        // Best-effort cleanup. The server also expires sessions by TTL.
      });
    };

    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      handlePageHide();
    };
  }, []);

  const loadCaptcha = useCallback(async () => {
    if (busy || connected) return;

    setFieldErrors({});
    setCaptchaAnswer("");
    setState(nedLoadingCaptchaState());

    try {
      const data = (await requestChallenge()) as NedChallengeResult | null;

      if (
        data &&
        data.ok === true &&
        typeof data.captchaImage === "string" &&
        typeof data.expiresAt === "number"
      ) {
        sessionActiveRef.current = true;
        setState(nedReadyState(data.captchaImage, data.expiresAt));
        return;
      }

      sessionActiveRef.current = false;
      setState(nedErrorState(readErrorCode(data)));
    } catch {
      sessionActiveRef.current = false;
      setState(nedErrorState("portal_unavailable"));
    }
  }, [busy, connected]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || connected) return;

    setFieldErrors({});

    const validation = validateNedCredentials({
      studentId,
      password,
      captchaAnswer,
    });

    if (!validation.ok) {
      const nextErrors: FieldErrors = {};
      for (const field of validation.fields) {
        nextErrors[field] = NED_FIELD_MESSAGES[field];
      }
      setFieldErrors(nextErrors);
      setState(nedErrorState("invalid_request", validation.fields));
      setPassword("");
      setCaptchaAnswer("");
      return;
    }

    setState(nedConnectingState(state));

    try {
      const data = (await requestConnect(
        validation.value,
      )) as NedConnectResult | null;

      if (
        data &&
        data.ok === true &&
        data.status === "connected" &&
        typeof data.expiresAt === "number"
      ) {
        sessionActiveRef.current = true;
        setState(nedConnectedState(data.expiresAt));
      } else {
        const fields = readFields(data);
        sessionActiveRef.current = false;
        setState(nedErrorState(readErrorCode(data), fields));
        if (fields.length > 0) {
          const nextErrors: FieldErrors = {};
          for (const field of fields) {
            nextErrors[field] = NED_FIELD_MESSAGES[field];
          }
          setFieldErrors(nextErrors);
        }
      }
    } catch {
      sessionActiveRef.current = false;
      setState(nedErrorState("portal_unavailable"));
    } finally {
      // Credentials and the CAPTCHA answer are cleared after every attempt,
      // successful or not. They are never written to storage.
      clearSecretFields();
    }
  };

  const disconnect = async () => {
    sessionActiveRef.current = false;
    setState(initialNedUiState);
    setFieldErrors({});
    clearSecretFields();

    try {
      await fetch("/api/ned/session", {
        method: "DELETE",
        cache: "no-store",
        credentials: "same-origin",
      });
    } catch {
      // The server session still expires by TTL; nothing sensitive is kept
      // in the browser.
    }
  };

  const statusLabel =
    state.status === "connected"
      ? "Verified"
      : state.status === "ready"
        ? "CAPTCHA ready"
        : state.status === "error"
          ? "Needs attention"
          : "Not connected";

  return (
    <section aria-labelledby="ned-heading" className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="ned-heading"
          className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
        >
          NED Portal Connection
        </h2>
        <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {statusLabel}
        </span>
      </div>

      <div className="space-y-4 border border-border bg-card p-3.5 sm:p-4">
        <div className="flex items-start gap-2 border border-border bg-muted/40 p-2.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Live NED authentication is not enabled yet: the real portal flow has
            not been verified. The CAPTCHA is always solved manually. When the
            verified flow ships, credentials will be sent only to this
            application&apos;s server for the connection attempt and will never
            be stored or logged.
          </p>
        </div>

        {connected ? (
          <div className="space-y-3">
            <div
              role="status"
              className="flex items-start gap-2 border border-status-safe/40 bg-status-safe/10 p-2.5 text-xs text-status-safe"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p className="leading-relaxed">{state.message}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={disconnect}
              className="h-8 rounded-none border-border bg-transparent px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-3.5" />
              Disconnect and clear session
            </Button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            autoComplete="off"
            noValidate
            className="space-y-3"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="ned-student-id"
                  className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Student ID
                </Label>
                <Input
                  id="ned-student-id"
                  type="text"
                  value={studentId}
                  onChange={(event) => setStudentId(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={64}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.studentId)}
                  aria-describedby={
                    fieldErrors.studentId ? "ned-student-id-error" : undefined
                  }
                  className="h-9 rounded-none border-border bg-background shadow-none"
                  placeholder="Your NED student ID"
                />
                {fieldErrors.studentId && (
                  <p
                    id="ned-student-id-error"
                    className="text-[11px] text-status-danger"
                  >
                    {fieldErrors.studentId}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="ned-password"
                  className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  Password
                </Label>
                <Input
                  id="ned-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="off"
                  maxLength={256}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "ned-password-error" : undefined
                  }
                  className="h-9 rounded-none border-border bg-background shadow-none"
                  placeholder="Your NED password"
                />
                {fieldErrors.password && (
                  <p
                    id="ned-password-error"
                    className="text-[11px] text-status-danger"
                  >
                    {fieldErrors.password}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    CAPTCHA
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Manual entry only
                  </span>
                </div>

                <div className="flex min-h-16 items-center justify-center border border-border bg-muted/40 p-2">
                  {state.captchaImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={state.captchaImage}
                      alt="NED CAPTCHA challenge. Enter the characters shown."
                      className="max-h-14 w-auto"
                    />
                  ) : (
                    <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                      CAPTCHA image unavailable. Use “Refresh CAPTCHA” once the
                      verified NED endpoint is configured.
                    </p>
                  )}
                </div>

                <Label
                  htmlFor="ned-captcha-answer"
                  className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
                >
                  CAPTCHA answer
                </Label>
                <Input
                  id="ned-captcha-answer"
                  type="text"
                  value={captchaAnswer}
                  onChange={(event) => setCaptchaAnswer(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={32}
                  disabled={busy}
                  aria-invalid={Boolean(fieldErrors.captchaAnswer)}
                  aria-describedby={
                    fieldErrors.captchaAnswer
                      ? "ned-captcha-answer-error"
                      : undefined
                  }
                  className="h-9 rounded-none border-border bg-background shadow-none"
                  placeholder="Type the characters exactly"
                />
                {fieldErrors.captchaAnswer && (
                  <p
                    id="ned-captcha-answer-error"
                    className="text-[11px] text-status-danger"
                  >
                    {fieldErrors.captchaAnswer}
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadCaptcha}
                disabled={busy}
                className="h-9 rounded-none border-border bg-transparent px-2.5 text-xs font-normal text-muted-foreground shadow-none hover:bg-muted hover:text-foreground"
              >
                {state.status === "loading_captcha" ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <RefreshCw className="size-3.5" />
                )}
                {state.status === "loading_captcha"
                  ? "Loading CAPTCHA"
                  : "Refresh CAPTCHA"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
              <Button
                type="submit"
                size="sm"
                disabled={busy || !state.captchaImage}
                className="h-8 rounded-none px-2.5 text-xs"
              >
                {state.status === "connecting" ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  <KeyRound className="size-3.5" />
                )}
                {state.status === "connecting"
                  ? "Connecting"
                  : "Connect to NED"}
              </Button>
              <p
                aria-live="polite"
                className={`text-[11px] leading-relaxed ${
                  state.status === "error"
                    ? "text-status-danger"
                    : "text-muted-foreground"
                }`}
              >
                {state.message}
              </p>
            </div>

            {state.status === "error" && state.fields.length > 0 && (
              <p className="flex items-start gap-1.5 border border-status-danger/40 bg-status-danger/10 p-2 text-[11px] leading-relaxed text-status-danger">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>Check the highlighted fields and try again.</span>
              </p>
            )}

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              SkipSafe requests only an attendance report. It never bypasses
              CAPTCHA, MFA or portal security. Sessions are temporary and expire
              automatically.
            </p>
          </form>
        )}
      </div>
    </section>
  );
}
