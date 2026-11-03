"use client";

import {
  ArrowRightLeft,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  fetchEvidenceCustodyEvents,
  fetchEvidenceCustodyRegistry,
  fetchInvestigationTriageQueue,
  registerEvidenceCustody,
  transferEvidenceCustody,
  verifyEvidenceCustody,
  type EvidenceIntegrityVerification,
} from "@/lib/api";

import {
  DEFAULT_CUSTODY_FILTERS,
  duplicateReference,
  filterCustody,
  isSha256,
  type CustodyFilters,
} from "@/lib/ev-custody";

import { useActionRunner } from "@/lib/ev-hooks";

import { humanize } from "@/lib/format";

import { clampPage, paginate } from "@/lib/list-utils";

import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";

import { ConfirmButton } from "./confirm-button";

import {
  CustodyFilterBar,
  EvidenceEventLog,
  VerificationResult,
} from "./ev-custody-parts";

import {
  ErrorBanner,
  HashText,
  SuccessBanner,
} from "./ev-ui";

import { Pager } from "./list-tools";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

const CUSTODIANS = [
  "analyst@fincrime.local",
  "senior@fincrime.local",
  "admin@fincrime.local",
];

const REGISTRY_PAGE_SIZE = 20;

export function EvidenceChainOfCustody() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const registryLoad = useLoad(
    fetchEvidenceCustodyRegistry,
    "Unable to load evidence custody registry."
  );

  // The case list only feeds the register form, so a failure there
  // must not hide the registry.
  const casesLoad = useLoad(
    fetchInvestigationTriageQueue,
    "Unable to load cases."
  );

  const registry = useMemo(
    () => registryLoad.data ?? [],
    [registryLoad.data]
  );

  const cases = useMemo(
    () => casesLoad.data ?? [],
    [casesLoad.data]
  );

  const [
    selectedCaseId,
    setSelectedCaseId,
  ] =
    useState<string>("");

  const [
    selectedEvidenceId,
    setSelectedEvidenceId,
  ] =
    useState<string>("");

  const [reference, setReference] =
    useState(
      "EVIDENCE-PORTFOLIO-001"
    );

  const [type, setType] =
    useState(
      "TRANSACTION_EXPORT"
    );

  const [title, setTitle] =
    useState(
      "Synthetic transaction evidence"
    );

  const [source, setSource] =
    useState(
      "local://portfolio/transactions.csv"
    );

  const [description, setDescription] =
    useState(
      "Synthetic evidence artifact registered for chain-of-custody demonstration."
    );

  const [contentSha, setContentSha] =
    useState(
      "a".repeat(
        64
      )
    );

  const [
    toCustodian,
    setToCustodian,
  ] =
    useState(
      "admin@fincrime.local"
    );

  const [
    transferNote,
    setTransferNote,
  ] =
    useState(
      "Transfer custody for independent evidence review."
    );

  const [filters, setFilters] =
    useState<CustodyFilters>(
      DEFAULT_CUSTODY_FILTERS
    );

  const [page, setPage] =
    useState(0);

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  // Last integrity check per evidence record. Keyed by id, so a
  // result that arrives after the selection moved on is kept for the
  // record it belongs to and never shown under another one.
  const [verifications, setVerifications] =
    useState<
      Record<
        string,
        EvidenceIntegrityVerification
      >
    >({});

  const {
    busy: action,
    error,
    errorKey,
    run,
    clearError,
  } =
    useActionRunner();

  // The case and the evidence follow the lists: a choice that is
  // missing from the data (or not made yet) falls back to the first.
  const activeCaseId =
    selectedCaseId &&
    cases.some(
      (item) =>
        item.caseId ===
        selectedCaseId
    )
      ? selectedCaseId
      : cases[0]?.caseId ??
        "";

  // Right after a registration the new id is selected before the
  // reloaded registry contains it; wait for it instead of showing
  // the first record for a moment.
  const selectionPending =
    selectedEvidenceId !== "" &&
    registryLoad.loading &&
    !registry.some(
      (item) =>
        item.id ===
        selectedEvidenceId
    );

  const activeEvidenceId =
    selectionPending
      ? ""
      : selectedEvidenceId &&
          registry.some(
            (item) =>
              item.id ===
              selectedEvidenceId
          )
        ? selectedEvidenceId
        : registry[0]?.id ??
          "";

  const fetchEvents = useCallback(
    (signal: AbortSignal) =>
      activeEvidenceId
        ? fetchEvidenceCustodyEvents(
            activeEvidenceId,
            signal
          ).then(
            (events) => ({
              evidenceId:
                activeEvidenceId,
              events,
            })
          )
        : Promise.resolve({
            evidenceId: "",
            events: [],
          }),
    [
      activeEvidenceId,
    ]
  );

  const eventsLoad = useLoad(
    fetchEvents,
    "Unable to load custody events."
  );

  // The events kept while another record loads belong to the
  // previous selection: only show them for the record on screen.
  const eventsForSelection =
    eventsLoad.data &&
    eventsLoad.data.evidenceId ===
      activeEvidenceId
      ? eventsLoad.data.events
      : null;

  const selectedEvidence =
    useMemo(
      () =>
        registry.find(
          (
            item
          ) =>
            item.id ===
            activeEvidenceId
        ) ?? null,
      [
        registry,
        activeEvidenceId,
      ]
    );

  const verifiedCount =
    useMemo(
      () =>
        registry.filter(
          (
            item
          ) =>
            item.currentStatus ===
            "VERIFIED"
        ).length,
      [
        registry,
      ]
    );

  const filtered =
    useMemo(
      () =>
        filterCustody(
          registry,
          filters
        ),
      [
        registry,
        filters,
      ]
    );

  const safePage =
    clampPage(
      page,
      filtered.length,
      REGISTRY_PAGE_SIZE
    );

  const pageItems =
    paginate(
      filtered,
      safePage,
      REGISTRY_PAGE_SIZE
    );

  const duplicate =
    duplicateReference(
      registry,
      activeCaseId,
      reference
    );

  const shaProblem =
    contentSha !== "" &&
    !isSha256(
      contentSha
    );

  const registerBlocked =
    !activeCaseId ||
    !reference.trim() ||
    !type.trim() ||
    !title.trim() ||
    !source.trim() ||
    !description.trim() ||
    !isSha256(
      contentSha
    ) ||
    duplicate !== null;

  const alreadyHeld =
    selectedEvidence !== null &&
    selectedEvidence.currentCustodian.toLowerCase() ===
      toCustodian.toLowerCase();

  function updateFilters(
    patch: Partial<CustodyFilters>
  ) {
    setFilters(
      (current) => ({
        ...current,
        ...patch,
      })
    );

    setPage(
      0
    );
  }

  function resetFilters() {
    setFilters(
      DEFAULT_CUSTODY_FILTERS
    );

    setPage(
      0
    );
  }

  function applyFilters(
    next: CustodyFilters
  ) {
    setFilters(
      next
    );

    setPage(
      0
    );
  }

  function refreshAll() {
    registryLoad.reload();

    eventsLoad.reload();
  }

  async function register() {
    if (
      !activeCaseId
    ) {
      return;
    }

    setNotice(
      null
    );

    await run(
      "register",
      () =>
        registerEvidenceCustody(
          activeCaseId,
          reference.trim(),
          type.trim(),
          title.trim(),
          source.trim(),
          description.trim(),
          contentSha.trim()
        ),
      "Unable to register evidence.",
      (created) => {
        setSelectedEvidenceId(
          created.id
        );

        setNotice(
          `Registered ${created.evidenceReference} for ${created.caseNumber}.`
        );

        registryLoad.reload();
      }
    );
  }

  async function transfer() {
    if (
      !selectedEvidence
    ) {
      return;
    }

    const evidenceId =
      selectedEvidence.id;

    setNotice(
      null
    );

    await run(
      `transfer:${evidenceId}`,
      () =>
        transferEvidenceCustody(
          evidenceId,
          toCustodian,
          transferNote.trim()
        ),
      "Unable to transfer evidence custody.",
      (updated) => {
        setNotice(
          `Custody of ${updated.evidenceReference} transferred to ${updated.currentCustodian}.`
        );

        registryLoad.reload();

        eventsLoad.reload();
      }
    );
  }

  async function verify() {
    if (
      !selectedEvidence
    ) {
      return;
    }

    const evidenceId =
      selectedEvidence.id;

    setNotice(
      null
    );

    // verifyEvidenceCustody takes no abort signal, so a result that
    // comes back late is stored under the id it was asked for.
    await run(
      `verify:${evidenceId}`,
      () =>
        verifyEvidenceCustody(
          evidenceId
        ),
      "Unable to verify evidence integrity.",
      (result) => {
        setVerifications(
          (current) => ({
            ...current,
            [evidenceId]:
              result,
          })
        );

        registryLoad.reload();

        eventsLoad.reload();
      }
    );
  }

  return (
    <section
      className="panel evidence-custody-panel"
      aria-busy={registryLoad.loading}
    >
      <div className="panel-heading evidence-custody-heading">
        <div>
          <div className="eyebrow">
            Evidence integrity
          </div>

          <h2>
            Chain-of-custody registry
          </h2>

          <p>
            Evidence artifacts are
            fingerprinted with SHA-256
            metadata/content digests and
            tracked through a chained,
            append-only custody history.
          </p>
        </div>

        <div className="evidence-custody-badge">
          <Fingerprint
            size={13}
          />

          Hash-chained custody
        </div>
      </div>

      {notice && (
        <SuccessBanner
          message={notice}
          onDismiss={() =>
            setNotice(null)
          }
        />
      )}

      {registryLoad.error && (
        <ErrorState
          compact
          title="Unable to load the evidence registry"
          message={registryLoad.error}
          onRetry={registryLoad.reload}
        />
      )}

      {registryLoad.data === null &&
        registryLoad.loading && (
          <LoadingState
            compact
            label="Loading evidence registry"
          />
        )}

      {registryLoad.data !== null && (
      <div className="evidence-custody-metrics">
        <Metric
          label="Registered"
          value={
            registry.length
          }
        />

        <Metric
          label="Verified"
          value={
            verifiedCount
          }
        />

        <Metric
          label="Custody events"
          value={
            registry.reduce(
              (
                total,
                item
              ) =>
                total +
                item.custodyEventCount,
              0
            )
          }
        />
      </div>
      )}

      <div className="evidence-register-card">
        <div className="evidence-card-heading">
          <div>
            <Fingerprint
              size={14}
            />

            <strong>
              Register evidence
            </strong>
          </div>
        </div>

        <div className="evidence-register-grid">
          <label>
            <span>
              Case
            </span>

            <select
              value={
                activeCaseId
              }
              disabled={
                cases.length === 0
              }
              onChange={(
                event
              ) =>
                setSelectedCaseId(
                  event.target.value
                )
              }
            >
              {cases.length === 0 && (
                <option value="">
                  {casesLoad.loading
                    ? "Loading cases..."
                    : "No cases available"}
                </option>
              )}

              {cases.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.caseId
                    }
                    value={
                      item.caseId
                    }
                  >
                    {
                      item.caseNumber
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            <span>
              Evidence reference
            </span>

            <input
              value={
                reference
              }
              aria-invalid={
                duplicate !== null
              }
              maxLength={
                160
              }
              onChange={(
                event
              ) =>
                setReference(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            <span>
              Type
            </span>

            <input
              value={
                type
              }
              maxLength={
                80
              }
              onChange={(
                event
              ) =>
                setType(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            <span>
              Title
            </span>

            <input
              value={
                title
              }
              maxLength={
                240
              }
              onChange={(
                event
              ) =>
                setTitle(
                  event.target.value
                )
              }
            />
          </label>

          <label>
            <span>
              Source
            </span>

            <input
              value={
                source
              }
              maxLength={
                600
              }
              onChange={(
                event
              ) =>
                setSource(
                  event.target.value
                )
              }
            />
          </label>

          <label className="evidence-register-wide">
            <span>
              Description
            </span>

            <input
              value={
                description
              }
              maxLength={
                2000
              }
              onChange={(
                event
              ) =>
                setDescription(
                  event.target.value
                )
              }
            />
          </label>

          <label className="evidence-register-wide">
            <span>
              Content SHA-256
            </span>

            <input
              value={
                contentSha
              }
              aria-invalid={
                shaProblem
              }
              maxLength={
                64
              }
              onChange={(
                event
              ) =>
                setContentSha(
                  event.target.value
                )
              }
            />
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={
              action !== null ||
              registerBlocked
            }
            onClick={() =>
              void register()
            }
          >
            <Fingerprint
              size={12}
            />

            {action ===
            "register"
              ? "Registering..."
              : "Register evidence"}
          </button>
        </div>

        {casesLoad.error && (
          <ErrorState
            compact
            title="Unable to load cases"
            message={casesLoad.error}
            onRetry={casesLoad.reload}
          />
        )}

        {duplicate && (
          <p className="ui-ev-hint ui-ev-hint-warn">
            This case already has evidence {duplicate.evidenceReference}.
            Use a different reference.
          </p>
        )}

        {shaProblem && (
          <p className="ui-ev-hint ui-ev-hint-warn">
            Content SHA-256 must be exactly 64 hexadecimal
            characters ({contentSha.length}/64 entered).
          </p>
        )}

        {error &&
          errorKey === "register" && (
            <ErrorBanner
              message={error}
              onDismiss={clearError}
            />
          )}
      </div>

      {registryLoad.data !== null && registry.length > 0 && (
        <CustodyFilterBar
          records={registry}
          filters={filters}
          filtered={filtered}
          refreshing={
            registryLoad.loading ||
            eventsLoad.loading
          }
          onChange={updateFilters}
          onReset={resetFilters}
          onApply={applyFilters}
          onRefresh={refreshAll}
        />
      )}

      {registryLoad.data !== null && (
      <div className="evidence-custody-layout">
        <div className="evidence-registry-list">
          {registry.length ===
            0 &&
            registryLoad.data !== null && (
              <EmptyState
                compact
                icon={
                  <Fingerprint
                    size={22}
                    aria-hidden="true"
                  />
                }
                title="No evidence registered"
                message="Register an evidence artifact against a case above to start its chain of custody."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      registryLoad.loading
                    }
                    onClick={
                      refreshAll
                    }
                  >
                    Refresh
                  </button>
                }
              />
            )}

          {registry.length > 0 &&
            filtered.length === 0 && (
              <EmptyState
                compact
                title="No evidence matches these filters"
                message="Try a different search or clear the filters."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={resetFilters}
                  >
                    Reset filters
                  </button>
                }
              />
            )}

          {pageItems.map(
            (
              item
            ) => (
              <button
                key={
                  item.id
                }
                type="button"
                aria-current={
                  item.id ===
                  activeEvidenceId
                    ? "true"
                    : undefined
                }
                className={
                  item.id ===
                  activeEvidenceId
                    ? "evidence-registry-row selected"
                    : "evidence-registry-row"
                }
                onClick={() =>
                  setSelectedEvidenceId(
                    item.id
                  )
                }
              >
                <div>
                  <strong>
                    {
                      item.evidenceReference
                    }
                  </strong>

                  <span>
                    {
                      item.caseNumber
                    }
                    {" · "}
                    {
                      humanize(
                        item.evidenceType
                      )
                    }
                  </span>
                </div>

                <div className="evidence-registry-status">
                  {
                    humanize(
                      item.currentStatus
                    )
                  }
                </div>
              </button>
            )
          )}

          <Pager
            page={safePage}
            pageSize={REGISTRY_PAGE_SIZE}
            total={filtered.length}
            label="Evidence pages"
            onPage={setPage}
          />
        </div>

        <div className="evidence-custody-workspace">
          {selectedEvidence ? (
            <>
              <div className="evidence-detail-head">
                <div>
                  <div className="eyebrow">
                    Evidence record
                  </div>

                  <h3>
                    {
                      selectedEvidence.title
                    }
                  </h3>

                  <p>
                    {
                      selectedEvidence.evidenceReference
                    }
                    {" · "}
                    {
                      selectedEvidence.caseNumber
                    }
                    {" · "}
                    {
                      selectedEvidence.currentCustodian
                    }
                  </p>
                </div>

                <div
                  className={
                    selectedEvidence.currentStatus ===
                    "VERIFIED"
                      ? "evidence-integrity-state valid"
                      : "evidence-integrity-state"
                  }
                >
                  <ShieldCheck
                    size={12}
                  />

                  {
                    humanize(
                      selectedEvidence.currentStatus
                    )
                  }
                </div>
              </div>

              <div className="evidence-hash-grid">
                <HashValue
                  label="Content SHA-256"
                  value={
                    selectedEvidence.contentSha256
                  }
                />

                <HashValue
                  label="Registry fingerprint"
                  value={
                    selectedEvidence.registryFingerprint
                  }
                />
              </div>

              <div className="evidence-transfer-card">
                <div className="evidence-card-heading">
                  <div>
                    <ArrowRightLeft
                      size={14}
                    />

                    <strong>
                      Custody controls
                    </strong>
                  </div>
                </div>

                <div className="evidence-transfer-grid">
                  <label>
                    <span>
                      Transfer to
                    </span>

                    <select
                      value={
                        toCustodian
                      }
                      disabled={
                        !canManage ||
                        action !== null
                      }
                      onChange={(
                        event
                      ) =>
                        setToCustodian(
                          event.target.value
                        )
                      }
                    >
                      {CUSTODIANS.map(
                        (
                          value
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {
                              value
                            }
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Transfer rationale
                    </span>

                    <input
                      value={
                        transferNote
                      }
                      maxLength={
                        2000
                      }
                      disabled={
                        !canManage ||
                        action !== null
                      }
                      onChange={(
                        event
                      ) =>
                        setTransferNote(
                          event.target.value
                        )
                      }
                    />
                  </label>

                  <ConfirmButton
                    className="secondary-button"
                    confirmLabel="Yes, transfer"
                    disabled={
                      !canManage ||
                      action !== null ||
                      !transferNote.trim() ||
                      alreadyHeld
                    }
                    onConfirm={() =>
                      void transfer()
                    }
                  >
                    <ArrowRightLeft
                      size={12}
                    />

                    {action ===
                    `transfer:${selectedEvidence.id}`
                      ? "Transferring..."
                      : "Transfer custody"}
                  </ConfirmButton>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      !canManage ||
                      action !== null
                    }
                    onClick={() =>
                      void verify()
                    }
                  >
                    <ShieldCheck
                      size={12}
                    />

                    {action ===
                    `verify:${selectedEvidence.id}`
                      ? "Verifying..."
                      : "Verify integrity"}
                  </button>
                </div>

                {!canManage && (
                  <p className="ui-ev-hint">
                    Transfers and integrity checks need the
                    Senior Analyst or Administrator role.
                  </p>
                )}

                {alreadyHeld && (
                  <p className="ui-ev-hint ui-ev-hint-warn">
                    This evidence is already held by {toCustodian}.
                    Choose a different custodian to transfer it.
                  </p>
                )}

                {error &&
                  errorKey !== "register" && (
                    <ErrorBanner
                      message={error}
                      onDismiss={clearError}
                    />
                  )}

                <VerificationResult
                  result={
                    verifications[
                      selectedEvidence.id
                    ] ?? null
                  }
                  verifying={
                    action ===
                    `verify:${selectedEvidence.id}`
                  }
                  currentStatus={
                    selectedEvidence.currentStatus
                  }
                />
              </div>

              <EvidenceEventLog
                key={
                  selectedEvidence.id
                }
                record={
                  selectedEvidence
                }
                events={
                  eventsForSelection
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
            </>
          ) : selectionPending ? (
            <LoadingState
              compact
              label="Loading evidence record"
            />
          ) : (
            <div className="evidence-custody-empty large">
              <Fingerprint
                size={26}
              />

              <strong>
                {registry.length === 0
                  ? "No evidence to show yet"
                  : "Select evidence"}
              </strong>
            </div>
          )}
        </div>
      </div>
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
    <div className="evidence-custody-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function HashValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="evidence-hash-value">
      <span>
        {label}
      </span>

      <HashText
        value={value}
        label={label}
        length={24}
      />
    </div>
  );
}
