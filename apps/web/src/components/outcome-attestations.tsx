"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Fingerprint,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  attestCaseOutcome,
  fetchCaseOutcomeAttestations,
  fetchCaseOutcomeAttestationVerifications,
  fetchGovernedCaseOutcomes,
  verifyCaseOutcomeAttestation,
  type CaseOutcomeAttestation,
  type CaseOutcomeAttestationVerification,
  type GovernedCaseOutcome,
} from "@/lib/api";
import { exportRowsAsCsv } from "@/lib/csv";
import {
  formatDateTime,
  humanize,
} from "@/lib/format";
import {
  ALL,
  countOptions,
  useActionRunner,
  useFilterState,
} from "@/lib/gv-common";
import {
  AWAITING_COLUMNS,
  AWAITING_PAGE_SIZE,
  DEFAULT_ATTESTATION_FILTERS,
  REGISTRY_COLUMNS,
  REGISTRY_PAGE_SIZE,
  STATUS_ORDER,
  VERIFICATION_LIMIT,
  awaitingOutcomes,
  buildRegistry,
  filterAwaiting,
  filterRegistry,
  integrityLabel,
  latestVerifications,
  type AttestationFilters,
} from "@/lib/gv-attestations";
import {
  clampPage,
  paginate,
  plural,
} from "@/lib/list-utils";
import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";
import { ConfirmButton } from "./confirm-button";
import {
  Banner,
  LoadNotice,
} from "./gv-parts";
import {
  ChipGroup,
  ExportButton,
  Pager,
  ResetButton,
  ResultCount,
  SavedViews,
  SearchField,
  SelectField,
  Toolbar,
} from "./list-tools";
import { StackedBar } from "./mini-charts";
import { EmptyState } from "./state-card";

interface AttestationPayload {
  outcomes: GovernedCaseOutcome[];
  attestations: CaseOutcomeAttestation[];
  verifications: CaseOutcomeAttestationVerification[];
}

const NO_OUTCOMES: GovernedCaseOutcome[] = [];

const NO_ATTESTATIONS: CaseOutcomeAttestation[] = [];

const NO_VERIFICATIONS: CaseOutcomeAttestationVerification[] = [];

const STATUS_TONES = {
  VERIFIED: "ok",
  FAILED: "danger",
  UNVERIFIED: "warning",
} as const;

export function OutcomeAttestations() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const fetchPayload =
    useCallback(
      async (
        signal: AbortSignal
      ): Promise<AttestationPayload> => {
        const [
          outcomes,
          attestations,
          verifications,
        ] =
          await Promise.all([
            fetchGovernedCaseOutcomes(
              signal
            ),
            fetchCaseOutcomeAttestations(
              signal
            ),
            fetchCaseOutcomeAttestationVerifications(
              signal
            ),
          ]);

        return {
          outcomes,
          attestations,
          verifications,
        };
      },
      []
    );

  const {
    data,
    error,
    loading,
    reload,
  } = useLoad(
    fetchPayload,
    "Unable to load outcome integrity attestations."
  );

  const outcomes =
    data
      ? data.outcomes
      : NO_OUTCOMES;

  const attestations =
    data
      ? data.attestations
      : NO_ATTESTATIONS;

  const verifications =
    data
      ? data.verifications
      : NO_VERIFICATIONS;

  const {
    filters,
    current,
    hasFilters,
    update,
    setPage,
    reset,
    apply,
  } = useFilterState<AttestationFilters>(
    DEFAULT_ATTESTATION_FILTERS
  );

  const [awaitingPage, setAwaitingPage] =
    useState(0);

  const runner =
    useActionRunner();

  const unattested =
    useMemo(
      () =>
        awaitingOutcomes(
          outcomes,
          attestations
        ),
      [
        outcomes,
        attestations,
      ]
    );

  const latestVerificationByAttestation =
    useMemo(
      () =>
        latestVerifications(
          verifications
        ),
      [
        verifications,
      ]
    );

  const registry =
    useMemo(
      () =>
        buildRegistry(
          attestations,
          latestVerificationByAttestation
        ),
      [
        attestations,
        latestVerificationByAttestation,
      ]
    );

  const awaitingRows =
    useMemo(
      () =>
        filterAwaiting(
          unattested,
          filters
        ),
      [
        unattested,
        filters,
      ]
    );

  const registryRows =
    useMemo(
      () =>
        filterRegistry(
          registry,
          filters
        ),
      [
        registry,
        filters,
      ]
    );

  const statusOptions =
    useMemo(
      () =>
        countOptions(
          filterRegistry(
            registry,
            {
              ...filters,
              status: ALL,
            }
          ).map(
            (row) =>
              row.status
          ),
          "All",
          {
            order: STATUS_ORDER,
            always: STATUS_ORDER,
            keep: filters.status,
            tones: STATUS_TONES,
            label: integrityLabel,
          }
        ),
      [
        registry,
        filters,
      ]
    );

  const outcomeOptions =
    useMemo(
      () =>
        countOptions(
          outcomes.map(
            (item) =>
              item.governedOutcome
          ),
          "All outcomes",
          {
            always:
              attestations.map(
                (item) =>
                  item.governedOutcome
              ),
            keep: filters.outcome,
          }
        ),
      [
        outcomes,
        attestations,
        filters.outcome,
      ]
    );

  const verifiedCount =
    registry.filter(
      (row) =>
        row.status ===
        "VERIFIED"
    ).length;

  const failedCount =
    registry.filter(
      (row) =>
        row.status ===
        "FAILED"
    ).length;

  const segments = [
    {
      key: "VERIFIED",
      label: "Verified",
      value: verifiedCount,
      tone: "ok" as const,
    },
    {
      key: "FAILED",
      label: integrityLabel(
        "FAILED"
      ),
      value: failedCount,
      tone: "danger" as const,
    },
    {
      key: "UNVERIFIED",
      label: integrityLabel(
        "UNVERIFIED"
      ),
      value:
        registry.length -
        verifiedCount -
        failedCount,
      tone: "warning" as const,
    },
    {
      key: "AWAITING",
      label: "Awaiting attestation",
      value: unattested.length,
      tone: "neutral" as const,
    },
  ];

  const registryPage =
    clampPage(
      filters.page,
      registryRows.length,
      REGISTRY_PAGE_SIZE
    );

  const awaitingPageNow =
    clampPage(
      awaitingPage,
      awaitingRows.length,
      AWAITING_PAGE_SIZE
    );

  // Nothing may be sent while a request runs or the lists refresh.
  const busy =
    runner.pending !== null ||
    loading;

  function change(
    patch: Partial<AttestationFilters>
  ) {
    update(patch);
    setAwaitingPage(0);
  }

  function clear() {
    reset();
    setAwaitingPage(0);
  }

  function attest(
    outcome: GovernedCaseOutcome
  ) {
    if (!canManage) {
      return;
    }

    void runner.run(
      `attest:${outcome.caseId}`,
      async () => {
        await attestCaseOutcome(
          outcome.caseId
        );

        reload();

        return `Attested ${outcome.caseNumber} (decision v${outcome.decisionVersion}).`;
      },
      "Unable to attest governed outcome."
    );
  }

  function verify(
    attestation: CaseOutcomeAttestation
  ) {
    if (!canManage) {
      return;
    }

    void runner.run(
      `verify:${attestation.id}`,
      async () => {
        const result =
          await verifyCaseOutcomeAttestation(
            attestation.id
          );

        reload();

        if (
          !result.integrityValid
        ) {
          throw new Error(
            `Integrity check failed for ${attestation.caseNumber}. ${result.detail}`
          );
        }

        return `${attestation.caseNumber}: integrity verified.`;
      },
      "Unable to verify outcome attestation."
    );
  }

  return (
    <section
      className="panel outcome-attestation-panel"
      aria-busy={loading}
    >
      <div className="panel-heading outcome-attestation-heading">
        <div>
          <div className="eyebrow">
            Cryptographic provenance
          </div>

          <h2>
            Case outcome integrity attestations
          </h2>

          <p>
            Governed outcomes receive a
            SHA-256 provenance fingerprint
            covering their maker,
            independent checker, executor,
            decision and execution lineage.
          </p>
        </div>

        <div className="outcome-attestation-control">
          <Fingerprint
            size={13}
            aria-hidden="true"
          />

          SHA-256 provenance
        </div>
      </div>

      {runner.error && (
        <Banner
          kind="error"
          onDismiss={runner.dismiss}
        >
          {runner.error}
        </Banner>
      )}

      {runner.notice && (
        <Banner
          kind="ok"
          onDismiss={runner.dismiss}
        >
          {runner.notice}
        </Banner>
      )}

      <LoadNotice
        data={data}
        error={error}
        onRetry={reload}
        label="Loading attestations"
        errorTitle="Unable to load outcome integrity attestations"
      />

      {data !== null && (
        <>
          <div className="outcome-attestation-metrics">
            <Metric
              label="Outcomes"
              value={
                outcomes.length
              }
            />

            <Metric
              label="Attested"
              value={
                attestations.length
              }
            />

            <Metric
              label="Verified"
              value={
                verifiedCount
              }
            />
          </div>

          {verifications.length >=
            VERIFICATION_LIMIT && (
            <div
              className="ui-notice"
              role="status"
            >
              <AlertTriangle
                size={15}
                aria-hidden="true"
              />

              <span>
                Verification results come
                from the
                {" "}
                {VERIFICATION_LIMIT}
                {" "}
                most recent verifications.
                An older attestation can
                show as not verified
                until it is verified
                again.
              </span>
            </div>
          )}

          {(attestations.length >
            0 ||
            outcomes.length >
              0) && (
            <div className="ui-gv-summary">
              <StackedBar
                segments={segments}
                label="Outcomes by attestation status"
              />
            </div>
          )}

          <Toolbar label="Filter attestations">
            <SearchField
              label="Search attestations"
              placeholder="Search case, user, outcome or hash..."
              value={filters.q}
              onChange={(q) =>
                change({
                  q,
                })
              }
            />

            <SelectField
              label="Filter by governed outcome"
              value={
                filters.outcome
              }
              options={
                outcomeOptions
              }
              onChange={(outcome) =>
                change({
                  outcome,
                })
              }
            />

            <ResetButton
              disabled={!hasFilters}
              onClick={clear}
            />

            <ExportButton
              label="Export registry"
              disabled={
                registryRows.length ===
                0
              }
              onExport={() =>
                exportRowsAsCsv(
                  "outcome-attestations",
                  registryRows,
                  REGISTRY_COLUMNS
                )
              }
            />

            <button
              type="button"
              className="ui-icon-text-button"
              disabled={loading}
              onClick={reload}
            >
              <RefreshCw
                size={14}
                className={
                  loading
                    ? "ui-spin"
                    : undefined
                }
                aria-hidden="true"
              />

              Refresh
            </button>
          </Toolbar>

          <SavedViews<AttestationFilters>
            storageKey="fcg.views.attestations"
            current={current}
            canSave={hasFilters}
            onApply={(saved) => {
              apply(saved);
              setAwaitingPage(0);
            }}
          />

          <div className="outcome-attestation-grid">
            <div className="outcome-attestation-card">
              <div className="outcome-attestation-card-heading">
                <div>
                  <Fingerprint
                    size={14}
                    aria-hidden="true"
                  />

                  <strong>
                    Awaiting attestation
                  </strong>
                </div>

                <span className="ui-gv-inline-actions">
                  {
                    unattested.length
                  }
                  {" outcomes"}

                  <ExportButton
                    disabled={
                      awaitingRows.length ===
                      0
                    }
                    onExport={() =>
                      exportRowsAsCsv(
                        "outcomes-awaiting-attestation",
                        awaitingRows,
                        AWAITING_COLUMNS
                      )
                    }
                  />
                </span>
              </div>

              <ResultCount
                shown={
                  awaitingRows.length
                }
                total={
                  unattested.length
                }
                noun={plural(
                  unattested.length,
                  "outcome"
                )}
                filtered={
                  hasFilters
                }
              />

              {unattested.length ===
                0 && (
                <div className="outcome-attestation-empty">
                  <BadgeCheck
                    size={22}
                    aria-hidden="true"
                  />

                  <strong>
                    All governed outcomes attested
                  </strong>
                </div>
              )}

              {unattested.length >
                0 &&
                awaitingRows.length ===
                  0 && (
                <EmptyState
                  compact
                  title="No outcomes match these filters"
                  action={
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={clear}
                    >
                      Clear filters
                    </button>
                  }
                />
              )}

              {paginate(
                awaitingRows,
                awaitingPageNow,
                AWAITING_PAGE_SIZE
              ).map(
                (outcome) => (
                  <article
                    key={
                      outcome.executionId
                    }
                    className="outcome-attestation-row"
                  >
                    <div>
                      <strong>
                        {
                          outcome.caseNumber
                        }
                      </strong>

                      <span>
                        {
                          humanize(
                            outcome.governedOutcome
                          )
                        }
                        {" · decision v"}
                        {
                          outcome.decisionVersion
                        }
                      </span>
                    </div>

                    <ConfirmButton
                      className="primary-button"
                      confirmLabel="Yes, attest"
                      disabled={
                        !canManage ||
                        busy
                      }
                      onConfirm={() =>
                        attest(
                          outcome
                        )
                      }
                    >
                      <Fingerprint
                        size={12}
                        aria-hidden="true"
                      />

                      {runner.pending ===
                      `attest:${outcome.caseId}`
                        ? "Attesting..."
                        : "Attest"}
                    </ConfirmButton>
                  </article>
                )
              )}

              <Pager
                label="Awaiting attestation pages"
                page={
                  awaitingPageNow
                }
                pageSize={
                  AWAITING_PAGE_SIZE
                }
                total={
                  awaitingRows.length
                }
                onPage={
                  setAwaitingPage
                }
              />
            </div>

            <div className="outcome-attestation-card">
              <div className="outcome-attestation-card-heading">
                <div>
                  <ShieldCheck
                    size={14}
                    aria-hidden="true"
                  />

                  <strong>
                    Integrity registry
                  </strong>
                </div>

                <span>
                  {
                    attestations.length
                  }
                  {" attestations"}
                </span>
              </div>

              <div className="ui-chips-row ui-gv-card-chips">
                <ChipGroup
                  label="Filter by integrity status"
                  value={
                    filters.status
                  }
                  options={
                    statusOptions
                  }
                  onChange={(status) =>
                    change({
                      status,
                    })
                  }
                />
              </div>

              <ResultCount
                shown={
                  registryRows.length
                }
                total={
                  attestations.length
                }
                noun={plural(
                  attestations.length,
                  "attestation"
                )}
                filtered={
                  hasFilters
                }
              />

              {attestations.length ===
                0 && (
                <div className="outcome-attestation-empty">
                  <Fingerprint
                    size={22}
                    aria-hidden="true"
                  />

                  <strong>
                    No attestation yet
                  </strong>
                </div>
              )}

              {attestations.length >
                0 &&
                registryRows.length ===
                  0 && (
                <EmptyState
                  compact
                  title="No attestations match these filters"
                  action={
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={clear}
                    >
                      Clear filters
                    </button>
                  }
                />
              )}

              {paginate(
                registryRows,
                registryPage,
                REGISTRY_PAGE_SIZE
              ).map(
                ({
                  attestation,
                  verification,
                  status,
                }) => (
                  <article
                    key={
                      attestation.id
                    }
                    className="outcome-integrity-row"
                  >
                    <div className="outcome-integrity-row-head">
                      <div>
                        <strong>
                          {
                            attestation.caseNumber
                          }
                          {" · v"}
                          {
                            attestation.decisionVersion
                          }
                        </strong>

                        <span>
                          {
                            humanize(
                              attestation.governedOutcome
                            )
                          }
                        </span>
                      </div>

                      <div
                        className={
                          status ===
                          "VERIFIED"
                            ? "outcome-integrity-state valid"
                            : status ===
                                "FAILED"
                              ? "outcome-integrity-state ui-gv-failed"
                              : "outcome-integrity-state"
                        }
                      >
                        {integrityLabel(
                          status
                        )}
                      </div>
                    </div>

                    <div className="outcome-integrity-hash">
                      <span>
                        Provenance
                      </span>

                      <code>
                        {
                          attestation.provenanceHash
                        }
                      </code>
                    </div>

                    <div className="outcome-integrity-hash">
                      <span>
                        Audit anchor
                      </span>

                      <code>
                        {
                          attestation.auditRootHash
                        }
                      </code>
                    </div>

                    <div className="outcome-integrity-actions">
                      <span>
                        Attested by
                        {" "}
                        {
                          attestation.attestedBy
                        }
                        {" · "}
                        {formatDateTime(
                          attestation.attestedAt
                        )}
                      </span>

                      <button
                        type="button"
                        className="secondary-button"
                        disabled={
                          !canManage ||
                          busy
                        }
                        onClick={() =>
                          verify(
                            attestation
                          )
                        }
                      >
                        <ShieldCheck
                          size={12}
                          aria-hidden="true"
                        />

                        {runner.pending ===
                        `verify:${attestation.id}`
                          ? "Verifying..."
                          : "Verify"}
                      </button>
                    </div>

                    {verification && (
                      <div
                        className={
                          verification.integrityValid
                            ? "outcome-verification-detail"
                            : "outcome-verification-detail ui-gv-failed"
                        }
                      >
                        {
                          verification.detail
                        }

                        <span className="ui-gv-meta">
                          {"Provenance "}
                          {verification.provenanceValid
                            ? "valid"
                            : "invalid"}
                          {" · audit anchor "}
                          {verification.auditAnchorPresent
                            ? "present"
                            : "missing"}
                          {" · verified by "}
                          {
                            verification.verifiedBy
                          }
                          {" · "}
                          {formatDateTime(
                            verification.verifiedAt
                          )}
                        </span>
                      </div>
                    )}
                  </article>
                )
              )}

              <Pager
                label="Integrity registry pages"
                page={registryPage}
                pageSize={
                  REGISTRY_PAGE_SIZE
                }
                total={
                  registryRows.length
                }
                onPage={setPage}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="outcome-attestation-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}
