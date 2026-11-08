import { randomBytes } from "node:crypto";

/**
 * Server-only temporary NED session store.
 *
 * Design notes:
 * - Sessions are keyed by a cryptographically random opaque ID. There is no
 *   single "current session" global; each record is isolated by key.
 * - Credentials and CAPTCHA answers are never fields on a session record.
 *   Only opaque adapter state (for example portal cookies) and timestamps live
 *   here. Adapters must not put credentials in `portalState`.
 * - The store is process-local. It is suitable for a single Node instance and
 *   for local development only; serverless/multi-instance deployments need a
 *   reviewed shared store with the same isolation and TTL guarantees.
 */

export type NedSessionPhase = "challenge" | "connected";

export type NedSessionRecord = {
  readonly createdAt: number;
  readonly expiresAt: number;
  phase: NedSessionPhase;
  /**
   * Opaque, server-only adapter state (portal cookies/session artefacts).
   * Never serialise this to the browser and never log it.
   */
  portalState: unknown;
};

export type NedSessionStoreOptions = {
  ttlMs?: number;
  maxSessions?: number;
  now?: () => number;
  idFactory?: () => string;
};

export type NedSessionCreateResult =
  | { ok: true; id: string; record: NedSessionRecord }
  | { ok: false; code: "too_many_requests" };

export type NedSessionStore = {
  create(portalState: unknown): NedSessionCreateResult;
  get(id: string): NedSessionRecord | null;
  markConnected(id: string, portalState: unknown): NedSessionRecord | null;
  delete(id: string): boolean;
  size(): number;
  clear(): void;
};

export const DEFAULT_NED_SESSION_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_NED_MAX_SESSIONS = 1_000;

export function createNedSessionStore(
  options: NedSessionStoreOptions = {},
): NedSessionStore {
  const ttlMs = options.ttlMs ?? DEFAULT_NED_SESSION_TTL_MS;
  const maxSessions = options.maxSessions ?? DEFAULT_NED_MAX_SESSIONS;
  const now = options.now ?? Date.now;
  const idFactory =
    options.idFactory ?? (() => randomBytes(32).toString("base64url"));
  const sessions = new Map<string, NedSessionRecord>();

  const sweep = (at: number): void => {
    for (const [id, record] of sessions) {
      if (record.expiresAt <= at) {
        sessions.delete(id);
      }
    }
  };

  return {
    create(portalState: unknown): NedSessionCreateResult {
      const at = now();
      sweep(at);

      if (sessions.size >= maxSessions) {
        return { ok: false, code: "too_many_requests" };
      }

      const id = idFactory();
      const record: NedSessionRecord = {
        createdAt: at,
        expiresAt: at + ttlMs,
        phase: "challenge",
        portalState,
      };
      sessions.set(id, record);
      return { ok: true, id, record };
    },

    get(id: string): NedSessionRecord | null {
      const at = now();
      const record = sessions.get(id);
      if (!record) return null;
      if (record.expiresAt <= at) {
        sessions.delete(id);
        return null;
      }
      return record;
    },

    markConnected(
      id: string,
      portalState: unknown,
    ): NedSessionRecord | null {
      const record = this.get(id);
      if (!record) return null;
      record.phase = "connected";
      record.portalState = portalState;
      return record;
    },

    delete(id: string): boolean {
      return sessions.delete(id);
    },

    size(): number {
      sweep(now());
      return sessions.size;
    },

    clear(): void {
      sessions.clear();
    },
  };
}
