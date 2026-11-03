import type { AuthLoginResponse } from "./api";

const STORAGE_KEY = "fincrime-graph.session.v1";

/**
 * Set NEXT_PUBLIC_PERSIST_SESSION=false to keep the access token in
 * memory only (a page refresh then signs the user out). Persisting to
 * sessionStorage is per-tab and cleared when the tab closes, but it is
 * readable by any script on the page, so turn it off for deployments
 * that need the stricter posture.
 */
export const PERSIST_SESSION =
  process.env.NEXT_PUBLIC_PERSIST_SESSION !== "false";

function isSession(value: unknown): value is AuthLoginResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AuthLoginResponse>;

  return (
    typeof candidate.accessToken === "string" &&
    typeof candidate.username === "string" &&
    typeof candidate.displayName === "string" &&
    typeof candidate.expiresAt === "string" &&
    Array.isArray(candidate.roles)
  );
}

export function isExpired(
  session: AuthLoginResponse,
  now = Date.now()
) {
  const expiry = Date.parse(session.expiresAt);

  return Number.isNaN(expiry) || expiry <= now;
}

export function loadSession(): AuthLoginResponse | null {
  if (!PERSIST_SESSION) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    if (!isSession(parsed) || isExpired(parsed)) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthLoginResponse) {
  if (!PERSIST_SESSION) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(session)
    );
  } catch {
    // Storage may be unavailable (private mode, quota); the session
    // simply stays in memory.
  }
}

export function clearSession() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
