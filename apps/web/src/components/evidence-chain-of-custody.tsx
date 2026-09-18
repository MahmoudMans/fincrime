"use client";

import {
  ArrowRightLeft,
  Fingerprint,
  ShieldCheck,
} from "lucide-react";

import {
  useEffect,
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
  type EvidenceCustodyEvent,
  type EvidenceCustodyRecord,
  type InvestigationTriageQueueItem,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

const CUSTODIANS = [
  "analyst@fincrime.local",
  "senior@fincrime.local",
  "admin@fincrime.local",
];

export function EvidenceChainOfCustody() {
  const {
    hasAnyRole,
  } = useAuth();

  const canManage =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [cases, setCases] =
    useState<
      InvestigationTriageQueueItem[]
    >([]);

  const [registry, setRegistry] =
    useState<
      EvidenceCustodyRecord[]
    >([]);

  const [events, setEvents] =
    useState<
      EvidenceCustodyEvent[]
    >([]);

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

  const [action, setAction] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.all([
      fetchInvestigationTriageQueue(
        controller.signal
      ),
      fetchEvidenceCustodyRegistry(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedCases,
          loadedRegistry,
        ]) => {
          setCases(
            loadedCases
          );

          setRegistry(
            loadedRegistry
          );

          if (
            loadedCases.length > 0
          ) {
            setSelectedCaseId(
              (
                current
              ) =>
                current ||
                loadedCases[0].caseId
            );
          }

          if (
            loadedRegistry.length > 0
          ) {
            setSelectedEvidenceId(
              (
                current
              ) =>
                current ||
                loadedRegistry[0].id
            );
          }

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
              : "Unable to load evidence custody registry."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  useEffect(() => {
    if (
      !selectedEvidenceId
    ) {
      return;
    }

    const controller =
      new AbortController();

    void fetchEvidenceCustodyEvents(
      selectedEvidenceId,
      controller.signal
    )
      .then(
        (
          loadedEvents
        ) => {
          setEvents(
            loadedEvents
          );
        }
      )
      .catch(
        (
          loadError: unknown
        ) => {
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
              : "Unable to load custody events."
          );
        }
      );

    return () =>
      controller.abort();
  }, [
    selectedEvidenceId,
  ]);

  const selectedEvidence =
    useMemo(
      () =>
        registry.find(
          (
            item
          ) =>
            item.id ===
            selectedEvidenceId
        ) ?? null,
      [
        registry,
        selectedEvidenceId,
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

  async function reload(
    evidenceId?: string
  ) {
    const loadedRegistry =
      await fetchEvidenceCustodyRegistry();

    setRegistry(
      loadedRegistry
    );

    const nextId =
      evidenceId ||
      selectedEvidenceId ||
      loadedRegistry[0]?.id ||
      "";

    if (
      nextId
    ) {
      setSelectedEvidenceId(
        nextId
      );

      setEvents(
        await fetchEvidenceCustodyEvents(
          nextId
        )
      );
    }
  }

  async function register() {
    if (
      !selectedCaseId
    ) {
      return;
    }

    try {
      setAction(
        "register"
      );

      setError(
        null
      );

      const created =
        await registerEvidenceCustody(
          selectedCaseId,
          reference,
          type,
          title,
          source,
          description,
          contentSha
        );

      await reload(
        created.id
      );

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to register evidence."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  async function transfer() {
    if (
      !selectedEvidence
    ) {
      return;
    }

    try {
      setAction(
        "transfer"
      );

      setError(
        null
      );

      await transferEvidenceCustody(
        selectedEvidence.id,
        toCustodian,
        transferNote
      );

      await reload(
        selectedEvidence.id
      );

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to transfer evidence custody."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  async function verify() {
    if (
      !selectedEvidence
    ) {
      return;
    }

    try {
      setAction(
        "verify"
      );

      setError(
        null
      );

      await verifyEvidenceCustody(
        selectedEvidence.id
      );

      await reload(
        selectedEvidence.id
      );

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to verify evidence integrity."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel evidence-custody-panel">
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

      {error && (
        <div className="evidence-custody-error">
          {error}
        </div>
      )}

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
                selectedCaseId
              }
              onChange={(
                event
              ) =>
                setSelectedCaseId(
                  event.target.value
                )
              }
            >
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
              !selectedCaseId ||
              contentSha.length !==
                64
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
      </div>

      <div className="evidence-custody-layout">
        <div className="evidence-registry-list">
          {registry.length ===
            0 && (
            <div className="evidence-custody-empty">
              <Fingerprint
                size={22}
              />

              <strong>
                No evidence registered
              </strong>
            </div>
          )}

          {registry.map(
            (
              item
            ) => (
              <button
                key={
                  item.id
                }
                type="button"
                className={
                  item.id ===
                  selectedEvidenceId
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

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      !canManage ||
                      action !== null ||
                      !transferNote.trim()
                    }
                    onClick={() =>
                      void transfer()
                    }
                  >
                    <ArrowRightLeft
                      size={12}
                    />

                    {action ===
                    "transfer"
                      ? "Transferring..."
                      : "Transfer custody"}
                  </button>

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
                    "verify"
                      ? "Verifying..."
                      : "Verify integrity"}
                  </button>
                </div>
              </div>

              <div className="evidence-event-card">
                <div className="evidence-card-heading">
                  <div>
                    <ShieldCheck
                      size={14}
                    />

                    <strong>
                      Custody history
                    </strong>
                  </div>

                  <span>
                    {
                      events.length
                    }
                    {" events"}
                  </span>
                </div>

                {events.map(
                  (
                    event
                  ) => (
                    <article
                      key={
                        event.id
                      }
                      className="evidence-event-row"
                    >
                      <div className="evidence-event-sequence">
                        #
                        {
                          event.sequenceNumber
                        }
                      </div>

                      <div>
                        <strong>
                          {
                            humanize(
                              event.eventType
                            )
                          }
                        </strong>

                        <span>
                          {
                            event.actorUsername
                          }
                          {" · "}
                          {
                            formatDateTime(
                              event.occurredAt
                            )
                          }
                        </span>

                        <p>
                          {
                            event.eventNote
                          }
                        </p>

                        <code>
                          {
                            event.eventHash
                          }
                        </code>
                      </div>
                    </article>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="evidence-custody-empty large">
              <Fingerprint
                size={26}
              />

              <strong>
                Select evidence
              </strong>
            </div>
          )}
        </div>
      </div>
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

      <code>
        {value}
      </code>
    </div>
  );
}

function humanize(
  value: string
) {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      (
        character
      ) =>
        character.toUpperCase()
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
    }
  ).format(
    new Date(
      value
    )
  );
}
