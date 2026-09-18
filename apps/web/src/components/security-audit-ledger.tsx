"use client";

import {
  Activity,
  CheckCircle2,
  Fingerprint,
  History,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchSecurityAuditLedgerHistory,
  fetchSecurityAuditLedgerStatus,
  refreshSecurityAuditLedger,
  type SecurityAuditLedgerStatus,
  type SecurityAuditLedgerVerification,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

export function SecurityAuditLedger() {
  const {
    hasAnyRole,
  } = useAuth();

  const isAdmin =
    hasAnyRole(
      "ADMIN"
    );

  const [status, setStatus] =
    useState<
      SecurityAuditLedgerStatus | null
    >(
      null
    );

  const [history, setHistory] =
    useState<
      SecurityAuditLedgerVerification[]
    >(
      []
    );

  const [action, setAction] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const controller =
      new AbortController();

    void Promise.all([
      fetchSecurityAuditLedgerStatus(
        controller.signal
      ),
      fetchSecurityAuditLedgerHistory(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedStatus,
          loadedHistory,
        ]) => {
          setStatus(
            loadedStatus
          );

          setHistory(
            loadedHistory
          );

          setError(
            null
          );
        }
      )
      .catch(
        (loadError: unknown) => {
          if (
            loadError instanceof DOMException &&
            loadError.name ===
              "AbortError"
          ) {
            return;
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load audit ledger."
          );
        }
      );

    return () =>
      controller.abort();
  }, [
    isAdmin,
  ]);

  const stateLabel =
    useMemo(
      () => {
        if (!status) {
          return "Unknown";
        }

        if (
          status.integrityValid
        ) {
          return "Verified";
        }

        if (
          status.chainValid &&
          !status.complete
        ) {
          return "Refresh required";
        }

        return "Integrity failure";
      },
      [
        status,
      ]
    );

  if (!isAdmin) {
    return null;
  }

  async function refresh() {
    try {
      setAction(
        "refresh"
      );

      setError(
        null
      );

      const result =
        await refreshSecurityAuditLedger();

      const updatedHistory =
        await fetchSecurityAuditLedgerHistory();

      setStatus(
        result.status
      );

      setHistory(
        updatedHistory
      );
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh audit ledger."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel audit-ledger-panel">
      <div className="panel-heading audit-ledger-heading">
        <div>
          <div className="eyebrow">
            Security integrity
          </div>

          <h2>
            Tamper-evident audit ledger
          </h2>

          <p>
            SHA-256 chained integrity
            verification over the
            application security audit
            trail.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            action !== null
          }
          onClick={() =>
            void refresh()
          }
        >
          <RefreshCw
            size={13}
          />

          {action === "refresh"
            ? "Verifying..."
            : "Refresh & verify"}
        </button>
      </div>

      {error && (
        <div className="audit-ledger-error">
          <ShieldAlert
            size={14}
          />

          {error}
        </div>
      )}

      <div className="audit-ledger-metrics">
        <LedgerMetric
          label="Source events"
          value={
            status?.sourceEventCount ??
            0
          }
          icon={
            <Activity
              size={15}
            />
          }
        />

        <LedgerMetric
          label="Ledger entries"
          value={
            status?.ledgerEntryCount ??
            0
          }
          icon={
            <Link2
              size={15}
            />
          }
        />

        <LedgerMetric
          label="Uncovered"
          value={
            status?.uncoveredEventCount ??
            0
          }
          icon={
            <ShieldAlert
              size={15}
            />
          }
        />

        <div
          className={
            status?.integrityValid
              ? "audit-ledger-state valid"
              : "audit-ledger-state"
          }
        >
          {status?.integrityValid ? (
            <CheckCircle2
              size={17}
            />
          ) : (
            <ShieldAlert
              size={17}
            />
          )}

          <span>
            Integrity
          </span>

          <strong>
            {stateLabel}
          </strong>
        </div>
      </div>

      <div className="audit-ledger-grid">
        <div className="audit-ledger-card">
          <div className="audit-ledger-card-heading">
            <div>
              <Fingerprint
                size={14}
              />

              <strong>
                Current ledger root
              </strong>
            </div>

            <span>
              SHA-256
            </span>
          </div>

          <div className="audit-root-hash">
            <LockKeyhole
              size={18}
            />

            <code>
              {status?.rootHash ??
                "No ledger checkpoint yet"}
            </code>
          </div>

          <div className="audit-ledger-flags">
            <IntegrityFlag
              label="Hash chain"
              active={
                status?.chainValid ??
                false
              }
            />

            <IntegrityFlag
              label="Coverage"
              active={
                status?.complete ??
                false
              }
            />

            <IntegrityFlag
              label="Overall integrity"
              active={
                status?.integrityValid ??
                false
              }
            />
          </div>

          <div className="audit-ledger-note">
            <Fingerprint
              size={13}
            />

            <span>
              Each security event is
              canonicalized and hashed.
              Every ledger hash includes
              the previous chain hash, so
              changing an already-covered
              source event invalidates the
              chain verification.
            </span>
          </div>
        </div>

        <div className="audit-ledger-card">
          <div className="audit-ledger-card-heading">
            <div>
              <History
                size={14}
              />

              <strong>
                Verification history
              </strong>
            </div>

            <span>
              {
                history.length
              }
              {" checks"}
            </span>
          </div>

          <div className="audit-verification-list">
            {history.length ===
              0 && (
              <div className="audit-ledger-empty">
                <History
                  size={22}
                />

                <strong>
                  No verification run
                </strong>

                <span>
                  Refresh the ledger to
                  create its first
                  verification record.
                </span>
              </div>
            )}

            {history.map(
              (verification) => (
                <article
                  key={
                    verification.id
                  }
                  className="audit-verification-row"
                >
                  <div
                    className={
                      verification.integrityValid
                        ? "audit-verification-icon valid"
                        : "audit-verification-icon"
                    }
                  >
                    {verification.integrityValid ? (
                      <CheckCircle2
                        size={13}
                      />
                    ) : (
                      <ShieldAlert
                        size={13}
                      />
                    )}
                  </div>

                  <div>
                    <strong>
                      {verification.integrityValid
                        ? "Integrity verified"
                        : "Verification attention"}
                    </strong>

                    <span>
                      {
                        verification.ledgerEntryCount
                      }
                      {" entries · +"}
                      {
                        verification.appendedCount
                      }
                      {" appended · "}
                      {formatDateTime(
                        verification.verifiedAt
                      )}
                    </span>

                    <p>
                      {
                        verification.detail
                      }
                    </p>
                  </div>
                </article>
              )
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function LedgerMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="audit-ledger-metric">
      <div>
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function IntegrityFlag({
  label,
  active,
}: {
  label: string;
  active: boolean;
}) {
  return (
    <div
      className={
        active
          ? "audit-integrity-flag valid"
          : "audit-integrity-flag"
      }
    >
      {active ? (
        <CheckCircle2
          size={12}
        />
      ) : (
        <ShieldAlert
          size={12}
        />
      )}

      <span>
        {label}
      </span>
    </div>
  );
}

function formatDateTime(
  value: string
) {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  ).format(
    new Date(value)
  );
}
