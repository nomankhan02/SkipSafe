import { createNedHandlers } from "./handlers";
import { nedPortalAdapter } from "./portalAdapter";
import { createNedSessionStore } from "./sessionStore";

/**
 * Server-only singletons for the NED boundary.
 *
 * The in-memory store is process-local and intentionally not shared with the
 * client. Multi-instance/serverless deployments must replace it with a
 * reviewed temporary store before the live NED flow ships.
 */
const store = createNedSessionStore();

export const nedHandlers = createNedHandlers({
  store,
  adapter: nedPortalAdapter,
});
