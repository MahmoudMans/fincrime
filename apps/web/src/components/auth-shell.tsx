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
  useState,
} from "react";

import {
  authenticateUser,
  setApiAccessToken,
  type AuthLoginResponse,
} from "@/lib/api";

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
      "Investigate alerts, entities and evidence.",
  },
  {
    username:
      "senior@fincrime.local",
    password:
      "FinCrime!Senior2026",
    role:
      "Senior Analyst",
    description:
      "Includes detection runs, assignment and case resolution.",
  },
  {
    username:
      "admin@fincrime.local",
    password:
      "FinCrime!Admin2026",
    role:
      "Administrator",
    description:
      "Full access plus security audit visibility.",
  },
];

export function AuthShell() {
  const [session, setSession] =
    useState<
      AuthLoginResponse | null
    >(null);

  const [username, setUsername] =
    useState(
      demoAccounts[0].username
    );

  const [password, setPassword] =
    useState(
      demoAccounts[0].password
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

  function logout() {
    setApiAccessToken(null);
    setSession(null);
    setError(null);
  }

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
            A graph-native financial
            crime investigation platform
            for detecting suspicious
            money movement, analyzing
            connected entities and
            managing auditable AML cases.
          </p>

          <div className="login-capabilities">
            <span>
              <Fingerprint size={15} />
              JWT authentication
            </span>

            <span>
              <ShieldCheck size={15} />
              Role-based authorization
            </span>

            <span>
              <Network size={15} />
              Neo4j investigations
            </span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <form
          className="login-card"
          onSubmit={(event) =>
            void login(event)
          }
        >
          <div className="login-card-icon">
            <LockKeyhole size={21} />
          </div>

          <div className="eyebrow">
            Analyst authentication
          </div>

          <h2>
            Sign in to FinCrime Graph
          </h2>

          <p>
            Choose one of the local demo
            identities or enter its
            credentials manually.
          </p>

          {error && (
            <div className="login-error">
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
              ? "Authenticating..."
              : "Sign in"}
          </button>

          <div className="demo-account-heading">
            Local demo identities
          </div>

          <div className="demo-account-list">
            {demoAccounts.map(
              (account) => (
                <button
                  key={
                    account.username
                  }
                  type="button"
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

          <div className="login-security-note">
            <ShieldCheck size={14} />

            <span>
              Local development accounts.
              Passwords can be overridden
              through environment
              variables.
            </span>
          </div>
        </form>
      </section>
    </main>
  );
}
