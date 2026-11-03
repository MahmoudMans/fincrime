"use client";

import {
  Activity,
  CheckCircle2,
  Fingerprint,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";

import {
  useCallback,
  useState,
} from "react";

import {
  fetchSecurityAudit,
  fetchSecurityAuditLedgerHistory,
  fetchSecurityAuditLedgerStatus,
  refreshSecurityAuditLedger,
  type SecurityAuditEvent,
} from "@/lib/api";

import {
  ledgerState,
  ledgerStateExplanation,
  ledgerStateLabel,
} from "@/lib/ev-audit";

import { useActionRunner } from "@/lib/ev-hooks";

import { formatDateTime } from "@/lib/format";

import { plural } from "@/lib/list-utils";

import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";

import {
  AuditEventsCard,
  VerificationHistoryCard,
} from "./ev-audit-parts";

import {
  CopyButton,
  ErrorBanner,
  SuccessBanner,
} from "./ev-ui";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

export function SecurityAuditLedger() {
  const {
    hasAnyRole,
  } = useAuth();

  const isAdmin =
    hasAnyRole(
      "ADMIN"
    );

  // Only Administrators may call these endpoints; everyone else gets
  // the access message below instead of a stream of 403 errors.
  const fetchLedger =
    useCallback(
      (signal: AbortSignal) =>
        isAdmin
          ? Promise.all([
              fetchSecurityAuditLedgerStatus(
                signal
              ),
              fetchSecurityAuditLedgerHistory(
                signal
              ),
            ]).then(
              ([
                status,
                history,
              ]) => ({
                status,
                history,
              })
            )
          : Promise.resolve(
              null
            ),
      [
        isAdmin,
      ]
    );

  const fetchEvents =
    useCallback(
      (signal: AbortSignal) =>
        isAdmin
          ? fetchSecurityAudit(
              signal
            )
          : Promise.resolve<
              SecurityAuditEvent[]
            >(
              []
            ),
      [
        isAdmin,
      ]
    );

  const ledgerLoad =
    useLoad(
      fetchLedger,
      "Unable to load audit ledger."
    );

  const eventsLoad =
    useLoad(
      fetchEvents,
      "Unable to load security events."
    );

  const status =
    ledgerLoad.data?.status ??
    null;

  const history =
    ledgerLoad.data?.history ??
    [];

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  const {
    busy: action,
    error,
    clearError,
    run,
  } =
    useActionRunner();

  const state =
    ledgerState(
      status
    );

  const stateLabel =
    ledgerStateLabel(
      state
    );

  if (!isAdmin) {
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
          </div>
        </div>

        <EmptyState
          icon={
            <LockKeyhole
              size={24}
              aria-hidden="true"
            />
          }
          title="Administrator access required"
          message="The audit ledger and the security event trail are only available to Administrators."
        />
      </section>
    );
  }

  async function refresh() {
    setNotice(
      null
    );

    await run(
      "refresh",
      () =>
        refreshSecurityAuditLedger(),
      "Unable to refresh audit ledger.",
      (result) => {
        setNotice(
          `Ledger refreshed: ${result.appendedCount} ${plural(
            result.appendedCount,
            "entry",
            "entries"
          )} appended. Integrity: ${ledgerStateLabel(
            ledgerState(
              result.status
            )
          )}.`
        );

        ledgerLoad.reload();

        eventsLoad.reload();
      }
    );
  }

  return (
    <section
      className="panel audit-ledger-panel"
      aria-busy={ledgerLoad.loading}
    >
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
            className={
              action === "refresh"
                ? "ui-spin"
                : undefined
            }
            aria-hidden="true"
          />

          {action === "refresh"
            ? "Verifying..."
            : "Refresh & verify"}
        </button>
      </div>

      {notice && (
        <SuccessBanner
          message={notice}
          onDismiss={() =>
            setNotice(null)
          }
        />
      )}

      {error && (
        <ErrorBanner
          message={error}
          onDismiss={clearError}
        />
      )}

      {ledgerLoad.error && (
        <ErrorState
          compact
          title="Unable to load the audit ledger"
          message={ledgerLoad.error}
          onRetry={ledgerLoad.reload}
        />
      )}

      {ledgerLoad.data === null &&
        ledgerLoad.loading && (
          <LoadingState
            compact
            label="Loading audit ledger"
          />
        )}

      {ledgerLoad.data !== null && (
      <>
      <div className="audit-ledger-metrics">
        <LedgerMetric
          label="Source events"
          value={
            status?.sourceEventCount ??
            null
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
            null
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
            null
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

      <p
        className={`ui-ev-state-note ui-ev-state-${state.toLowerCase()}`}
        role="status"
      >
        {ledgerStateExplanation(
          status
        )}

        {status &&
          ` Last verified ${formatDateTime(status.verifiedAt)} UTC.`}
      </p>

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

            {status?.rootHash && (
              <CopyButton
                value={
                  status.rootHash
                }
                label="ledger root hash"
              />
            )}
          </div>

          <div className="audit-ledger-flags">
            <IntegrityFlag
              label="Hash chain"
              onText="valid"
              offText="invalid"
              active={
                status?.chainValid ??
                false
              }
            />

            <IntegrityFlag
              label="Coverage"
              onText="complete"
              offText="incomplete"
              active={
                status?.complete ??
                false
              }
            />

            <IntegrityFlag
              label="Overall integrity"
              onText="verified"
              offText="not verified"
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

        <VerificationHistoryCard
          history={history}
        />
      </div>
      </>
      )}

      <div className="ui-ev-events-wrap">
        <AuditEventsCard
          events={
            eventsLoad.data
          }
          loading={
            eventsLoad.loading
          }
          error={
            eventsLoad.error
          }
          onRetry={
            eventsLoad.reload
          }
        />
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
  value: number | null;
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
        {value ?? "—"}
      </strong>
    </div>
  );
}

function IntegrityFlag({
  label,
  active,
  onText,
  offText,
}: {
  label: string;
  active: boolean;
  onText: string;
  offText: string;
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
        {": "}
        {active
          ? onText
          : offText}
      </span>
    </div>
  );
}
