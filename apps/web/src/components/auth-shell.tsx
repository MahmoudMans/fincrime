"use client";

import {
  Fingerprint,
  KeyRound,
  LockKeyhole,
  Network,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  authenticateUser,
  setApiAccessToken,
  setUnauthorizedHandler,
  type AuthLoginResponse,
} from "@/lib/api";
import {
  clearSession,
  loadSession,
  saveSession,
} from "@/lib/session";
import {
  AuthProvider,
} from "./auth-context";
import {
  DashboardShell,
} from "./dashboard-shell";

const demoAccounts = [
  {
    username:
      "analyst@fincrime.local",
    password:
      "FinCrime!Analyst2026",
    role:
      "AML Analyst",
    description:
      "Investigate alerts, entities, evidence and case findings.",
  },
  {
    username:
      "senior@fincrime.local",
    password:
      "FinCrime!Senior2026",
    role:
      "Senior Analyst",
    description:
      "Run detections, assign investigations and review case decisions.",
  },
  {
    username:
      "admin@fincrime.local",
    password:
      "FinCrime!Admin2026",
    role:
      "Administrator",
    description:
      "Manage governed releases and access security audit controls.",
  },
];

/**
 * The demo identities (and their passwords) are convenient locally but
 * are shipped in the browser bundle. Build with
 * NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=false to remove the picker and start
 * with empty credential fields.
 */
const SHOW_DEMO_ACCOUNTS =
  process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false";

const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

export function AuthShell() {
  const [session, setSession] =
    useState<
      AuthLoginResponse | null
    >(null);

  // True until sessionStorage has been checked, so a signed-in user
  // does not see the login form flash on every refresh.
  const [restoring, setRestoring] =
    useState(true);

  const [notice, setNotice] =
    useState<string | null>(null);

  const [username, setUsername] =
    useState(
      SHOW_DEMO_ACCOUNTS
        ? demoAccounts[0].username
        : ""
    );

  const [password, setPassword] =
    useState(
      SHOW_DEMO_ACCOUNTS
        ? demoAccounts[0].password
        : ""
    );

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  async function login(
    event: FormEvent
  ) {
    event.preventDefault();

    try {
      setBusy(true);
      setError(null);

      const authenticated =
        await authenticateUser(
          username.trim(),
          password
        );

      setApiAccessToken(
        authenticated.accessToken
      );

      saveSession(authenticated);

      setNotice(null);

      setSession(
        authenticated
      );
    } catch (loginError) {
      setApiAccessToken(null);

      setError(
        loginError instanceof Error
          ? loginError.message
          : "Authentication failed."
      );
    } finally {
      setBusy(false);
    }
  }

  const endSession = useCallback(
    (message: string | null) => {
      setApiAccessToken(null);
      clearSession();
      setSession(null);
      setError(null);
      setNotice(message);
    },
    []
  );

  function logout() {
    endSession(null);
  }

  // Restore a session that survived a page refresh. sessionStorage only
  // exists in the browser, so it cannot be read during render without a
  // server/client mismatch. The state is applied from a timer callback
  // (not synchronously in the effect body), and the sign-in form stays
  // hidden until it has been applied.
  useEffect(() => {
    const restored = loadSession();

    const timer = window.setTimeout(() => {
      if (restored) {
        setApiAccessToken(restored.accessToken);
        setSession(restored);
      }

      setRestoring(false);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Sign out when the token expires, or as soon as any API call
  // reports that it is no longer valid.
  useEffect(() => {
    if (!session) {
      return;
    }

    setUnauthorizedHandler(() =>
      endSession(SESSION_EXPIRED_MESSAGE)
    );

    const remaining =
      Date.parse(session.expiresAt) - Date.now();

    // setTimeout cannot hold delays beyond about 24 days.
    const timer = Number.isNaN(remaining)
      ? undefined
      : window.setTimeout(
          () => endSession(SESSION_EXPIRED_MESSAGE),
          Math.min(Math.max(remaining, 0), 2_000_000_000)
        );

    return () => {
      setUnauthorizedHandler(null);

      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    };
  }, [session, endSession]);

  function chooseAccount(
    account:
      (typeof demoAccounts)[number]
  ) {
    setUsername(
      account.username
    );

    setPassword(
      account.password
    );

    setError(null);
  }

  if (restoring) {
    return (
      <main
        className="login-screen"
        aria-busy="true"
        aria-label="Loading"
      />
    );
  }

  if (session) {
    return (
      <AuthProvider
        session={session}
        logout={logout}
      >
        <DashboardShell />
      </AuthProvider>
    );
  }

  return (
    <main className="login-screen">
      <section className="login-hero">
        <div className="login-brand">
          <div className="login-brand-mark">
            <Network size={25} />
          </div>

          <div>
            <strong>
              FinCrime Graph
            </strong>

            <span>
              Financial Intelligence
              Platform
            </span>
          </div>
        </div>

        <div className="login-hero-copy">
          <div className="eyebrow">
            Secure investigation
            workspace
          </div>

          <h1>
            Follow the money.
            <br />
            Preserve the evidence.
          </h1>

          <p>
            Investigate suspicious money
            movement across connected
            entities, review supporting
            evidence, and manage auditable
            AML cases from a single
            graph-native workspace.
          </p>

          <div className="login-capabilities">
            <span>
              <Fingerprint size={15} />
              Graph investigations
            </span>

            <span>
              <ShieldCheck size={15} />
              Evidence governance
            </span>

            <span>
              <Network size={15} />
              Auditable case decisions
            </span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form
          className="login-card"
          aria-busy={busy}
          onSubmit={(event) =>
            void login(event)
          }
        >
          <div className="login-card-icon">
            <LockKeyhole size={21} />
          </div>

          <div className="eyebrow">
            Secure workspace access
          </div>

          <h2>
            Sign in to FinCrime Graph
          </h2>

          <p>
            Choose a local demo identity
            or enter credentials manually.
          </p>

          {notice && (
            <div
              className="login-notice"
              role="status"
            >
              {notice}
            </div>
          )}

          {SHOW_DEMO_ACCOUNTS && (
            <>
          <div className="demo-account-heading">
            Demo identity
          </div>

          <p className="demo-account-help">
            Selecting a demo identity fills
            the local credentials below.
          </p>

          <div
            className="demo-account-list"
            role="group"
            aria-label="Demo identity"
          >
            {demoAccounts.map(
              (account) => (
                <button
                  key={
                    account.username
                  }
                  type="button"
                  aria-pressed={
                    username ===
                    account.username
                  }
                  className={
                    username ===
                    account.username
                      ? "demo-account selected"
                      : "demo-account"
                  }
                  onClick={() =>
                    chooseAccount(
                      account
                    )
                  }
                >
                  <UserRoundCheck
                    size={15}
                  />

                  <div>
                    <strong>
                      {account.role}
                    </strong>

                    <span>
                      {
                        account
                          .description
                      }
                    </span>
                  </div>
                </button>
              )
            )}
          </div>
            </>
          )}

          {error && (
            <div
              className="login-error"
              role="alert"
              aria-live="polite"
            >
              {error}
            </div>
          )}

          <label className="login-field">
            <span>Email</span>

            <input
              type="email"
              value={username}
              autoComplete="username"
              onChange={(event) =>
                setUsername(
                  event.target.value
                )
              }
            />
          </label>

          <label className="login-field">
            <span>Password</span>

            <input
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) =>
                setPassword(
                  event.target.value
                )
              }
            />
          </label>

          <button
            type="submit"
            className="primary-button login-submit"
            disabled={
              busy ||
              !username.trim() ||
              !password
            }
          >
            <KeyRound size={15} />

            {busy
              ? "Signing in..."
              : "Sign in"}
          </button>

          <div className="login-security-note">
            <ShieldCheck size={14} />

            <div>
              <strong>
                Local demo environment
              </strong>

              <span>
                Demo credentials are
                configured for development
                and can be overridden
                through environment
                variables.
              </span>
            </div>
          </div>
        </form>
      </section>
    </main>
  );
}
