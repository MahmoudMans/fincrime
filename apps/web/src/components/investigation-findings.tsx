"use client";

import {
  CheckCircle2,
  FileCheck2,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  fetchEvidenceCustodyRegistry,
  fetchEvidenceReviews,
  fetchInvestigationFindings,
  reviewInvestigationFinding,
  submitInvestigationFinding,
  type EvidenceCustodyRecord,
  type EvidenceReviewRecord,
  type InvestigationFinding,
} from "@/lib/api";

import {
  exportRowsAsCsv,
} from "@/lib/csv";

import {
  formatDateTime,
  formatRelativeTime,
} from "@/lib/format";

import {
  clampPage,
  paginate,
} from "@/lib/list-utils";

import {
  useLoad,
} from "@/lib/use-load";

import {
  useIsMounted,
} from "@/lib/wf-common";

import {
  DEFAULT_FINDING_FILTERS,
  FINDING_CSV_COLUMNS,
  filterFindings,
  sortFindings,
  type FindingFilters,
} from "@/lib/wf-findings";

import {
  useAuth,
} from "./auth-context";

import {
  ConfirmButton,
} from "./confirm-button";

import {
  Pager,
} from "./list-tools";

import {
  StackedBar,
} from "./mini-charts";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

import {
  FindingTools,
} from "./wf-findings-tools";

interface EvidenceData {
  evidence: EvidenceCustodyRecord[];
  reviews: EvidenceReviewRecord[];
}

const PAGE_SIZE = 10;

const EMPTY_EVIDENCE: EvidenceCustodyRecord[] = [];

const EMPTY_REVIEWS: EvidenceReviewRecord[] = [];

const EMPTY_FINDINGS: InvestigationFinding[] = [];

async function loadEvidence(
  signal: AbortSignal
): Promise<EvidenceData> {
  const [evidence, reviews] =
    await Promise.all([
      fetchEvidenceCustodyRegistry(
        signal
      ),

      fetchEvidenceReviews(
        signal
      ),
    ]);

  return {
    evidence,
    reviews,
  };
}

export function InvestigationFindings() {
  const {
    hasAnyRole,
  } = useAuth();

  const isMounted =
    useIsMounted();

  const canSubmit =
    hasAnyRole(
      "AML_ANALYST"
    );

  const canReview =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const findingsLoad =
    useLoad(
      fetchInvestigationFindings,
      "Unable to load investigation findings."
    );

  // Only the submit form needs the evidence; the findings list must
  // stay usable when this part fails.
  const evidenceLoad =
    useLoad(
      loadEvidence,
      "Unable to load evidence accepted for analysis."
    );

  const [filters, setFilters] =
    useState<FindingFilters>(
      DEFAULT_FINDING_FILTERS
    );

  const [page, setPage] =
    useState(0);

  const [
    selectedEvidenceId,
    setSelectedEvidenceId,
  ] =
    useState<string>("");

  const [
    findingReference,
    setFindingReference,
  ] =
    useState(
      "FINDING-001"
    );

  const [title, setTitle] =
    useState(
      "Evidence-backed transaction pattern"
    );

  const [
    narrative,
    setNarrative,
  ] =
    useState(
      "The independently accepted evidence lineage supports escalation of the identified transaction pattern for formal investigation conclusions."
    );

  const [
    reviewNote,
    setReviewNote,
  ] =
    useState(
      "Independent review completed against the frozen evidence lineage."
    );

  const [action, setAction] =
    useState<string | null>(
      null
    );

  const [
    actionFailure,
    setActionFailure,
  ] =
    useState<string | null>(
      null
    );

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  const findings =
    findingsLoad.data ??
    EMPTY_FINDINGS;

  const evidence =
    evidenceLoad.data?.evidence ??
    EMPTY_EVIDENCE;

  const evidenceReviews =
    evidenceLoad.data?.reviews ??
    EMPTY_REVIEWS;

  // Disabled while a request runs or a reload is still in flight, so
  // a finding cannot be reviewed twice from stale data.
  const busy =
    action !== null ||
    findingsLoad.loading;

  const acceptedEvidence =
    useMemo(
      () =>
        evidence.filter(
          (
            item
          ) =>
            item.currentStatus ===
              "VERIFIED" &&
            evidenceReviews.some(
              (
                review
              ) =>
                review.evidenceId ===
                  item.id &&
                review.reviewDecision ===
                  "ACCEPTED_FOR_ANALYSIS" &&
                review.lineageCurrent
            )
        ),
      [
        evidence,
        evidenceReviews,
      ]
    );

  const activeEvidenceId =
    selectedEvidenceId &&
    acceptedEvidence.some(
      (
        item
      ) =>
        item.id ===
        selectedEvidenceId
    )
      ? selectedEvidenceId
      : acceptedEvidence[0]?.id ??
        "";

  const selectedEvidence =
    useMemo(
      () =>
        acceptedEvidence.find(
          (
            item
          ) =>
            item.id ===
            activeEvidenceId
        ) ?? null,
      [
        acceptedEvidence,
        activeEvidenceId,
      ]
    );

  const pendingFindings =
    useMemo(
      () =>
        findings.filter(
          (
            item
          ) =>
            item.status ===
            "PENDING"
        ),
      [
        findings,
      ]
    );

  const approvedFindings =
    useMemo(
      () =>
        findings.filter(
          (
            item
          ) =>
            item.status ===
            "APPROVED"
        ),
      [
        findings,
      ]
    );

  const rejectedCount =
    useMemo(
      () =>
        findings.filter(
          (
            item
          ) =>
            item.status ===
            "REJECTED"
        ).length,
      [
        findings,
      ]
    );

  const filtered =
    useMemo(
      () =>
        sortFindings(
          filterFindings(
            findings,
            filters
          ),
          filters.sort
        ),
      [
        findings,
        filters,
      ]
    );

  const safePage =
    clampPage(
      page,
      filtered.length,
      PAGE_SIZE
    );

  const pageItems =
    paginate(
      filtered,
      safePage,
      PAGE_SIZE
    );

  function update(
    patch: Partial<FindingFilters>
  ) {
    setFilters(
      (current) => ({
        ...current,
        ...patch,
      })
    );

    setPage(0);
  }

  function apply(
    next: FindingFilters
  ) {
    setFilters(
      next
    );

    setPage(0);
  }

  async function submit() {
    if (
      !selectedEvidence ||
      busy
    ) {
      return;
    }

    try {
      setAction(
        "submit"
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      const created =
        await submitInvestigationFinding(
          selectedEvidence.caseId,
          findingReference.trim(),
          title.trim(),
          narrative.trim(),
          selectedEvidence.id
        );

      if (!isMounted()) {
        return;
      }

      setNotice(
        `Finding ${created.findingReference} (version ${created.findingVersion}) submitted for independent review.`
      );

      setPage(0);

      findingsLoad.reload();
    } catch (failure) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        failure instanceof Error
          ? failure.message
          : "Unable to submit investigation finding."
      );
    } finally {
      if (isMounted()) {
        setAction(
          null
        );
      }
    }
  }

  async function review(
    findingId: string,
    label: string,
    decision: string
  ) {
    if (
      !canReview ||
      busy ||
      !reviewNote.trim()
    ) {
      return;
    }

    try {
      setAction(
        findingId
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      await reviewInvestigationFinding(
        findingId,
        decision,
        reviewNote.trim()
      );

      if (!isMounted()) {
        return;
      }

      setNotice(
        `${label} ${
          decision ===
          "APPROVED"
            ? "approved"
            : "rejected"
        }.`
      );

      findingsLoad.reload();
    } catch (failure) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        failure instanceof Error
          ? failure.message
          : "Unable to review investigation finding."
      );
    } finally {
      if (isMounted()) {
        setAction(
          null
        );
      }
    }
  }

  return (
    <section
      className="panel investigation-findings-panel"
      aria-busy={
        findingsLoad.loading
      }
    >
      <div className="panel-heading investigation-findings-heading">
        <div>
          <div className="eyebrow">
            Evidence-backed conclusions
          </div>

          <h2>
            Investigation findings
          </h2>

          <p>
            Findings may only reference
            integrity-verified evidence
            independently accepted for
            analysis. The exact evidence
            review and cryptographic
            lineage are frozen with each
            finding version.
          </p>
        </div>

        <div className="investigation-findings-badge">
          <ShieldCheck
            size={13}
            aria-hidden="true"
          />

          Evidence lineage locked
        </div>
      </div>

      {actionFailure && (
        <div
          className="investigation-findings-error"
          role="alert"
        >
          {actionFailure}
        </div>
      )}

      {notice && (
        <div
          className="ui-notice ui-wf-ok"
          role="status"
        >
          <CheckCircle2
            size={15}
            aria-hidden="true"
          />

          <span>
            {notice}
          </span>
        </div>
      )}

      {findingsLoad.error &&
        !findingsLoad.data && (
          <ErrorState
            title="Unable to load investigation findings"
            message={
              findingsLoad.error
            }
            onRetry={
              findingsLoad.reload
            }
          />
        )}

      {findingsLoad.error &&
        findingsLoad.data && (
          <ErrorState
            compact
            title="Could not refresh the findings"
            message={
              findingsLoad.error
            }
            onRetry={
              findingsLoad.reload
            }
          />
        )}

      {!findingsLoad.error &&
        !findingsLoad.data && (
          <LoadingState label="Loading investigation findings" />
        )}

      {findingsLoad.data && (
        <>
          <div className="investigation-findings-metrics">
            <Metric
              label="Findings"
              value={
                findings.length
              }
            />

            <Metric
              label="Pending"
              value={
                pendingFindings.length
              }
            />

            <Metric
              label="Approved"
              value={
                approvedFindings.length
              }
            />
          </div>

          <div className="ui-wf-summary">
            <StackedBar
              label="Findings by status"
              segments={[
                {
                  key: "PENDING",
                  label: "Pending",
                  value:
                    pendingFindings.length,
                  tone: "warning",
                },
                {
                  key: "APPROVED",
                  label: "Approved",
                  value:
                    approvedFindings.length,
                  tone: "ok",
                },
                {
                  key: "REJECTED",
                  label: "Rejected",
                  value:
                    rejectedCount,
                  tone: "danger",
                },
              ]}
            />
          </div>
        </>
      )}

      <div className="finding-submit-card">
        <div className="finding-card-heading">
          <div>
            <FileText
              size={14}
              aria-hidden="true"
            />

            <strong>
              Submit evidence-backed finding
            </strong>
          </div>

          <span>
            Analyst maker
          </span>
        </div>

        {evidenceLoad.error && (
          <ErrorState
            compact
            title="Accepted evidence is unavailable"
            message={
              evidenceLoad.error
            }
            onRetry={
              evidenceLoad.reload
            }
          />
        )}

        {!evidenceLoad.error &&
          !evidenceLoad.data && (
            <LoadingState
              compact
              label="Loading accepted evidence"
            />
          )}

        {evidenceLoad.data &&
          acceptedEvidence.length ===
            0 && (
            <p
              className="ui-wf-hint"
              role="status"
            >
              No evidence has been
              accepted for analysis
              yet. A finding can only
              cite integrity-verified
              evidence whose current
              review accepted it.
            </p>
          )}

        <div className="finding-submit-grid">
          <label>
            <span>
              Accepted evidence
            </span>

            <select
              value={
                activeEvidenceId
              }
              disabled={
                !canSubmit ||
                busy
              }
              onChange={(
                event
              ) =>
                setSelectedEvidenceId(
                  event.target.value
                )
              }
            >
              {acceptedEvidence.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.id
                    }
                    value={
                      item.id
                    }
                  >
                    {
                      item.evidenceReference
                    }
                    {" · "}
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
              Finding reference
            </span>

            <input
              value={
                findingReference
              }
              maxLength={
                160
              }
              disabled={
                !canSubmit ||
                busy
              }
              onChange={(
                event
              ) =>
                setFindingReference(
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
              disabled={
                !canSubmit ||
                busy
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

          <label className="finding-submit-wide">
            <span>
              Finding narrative
            </span>

            <textarea
              value={
                narrative
              }
              maxLength={
                4000
              }
              disabled={
                !canSubmit ||
                busy
              }
              onChange={(
                event
              ) =>
                setNarrative(
                  event.target.value
                )
              }
            />
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={
              !canSubmit ||
              busy ||
              !selectedEvidence ||
              !findingReference.trim() ||
              !title.trim() ||
              !narrative.trim()
            }
            onClick={() =>
              void submit()
            }
          >
            <FileCheck2
              size={12}
              aria-hidden="true"
            />

            {action ===
            "submit"
              ? "Submitting..."
              : "Submit finding"}
          </button>
        </div>

        {selectedEvidence && (
          <div className="finding-evidence-proof">
            <div>
              <span>
                Registry fingerprint
              </span>

              <code>
                {
                  selectedEvidence.registryFingerprint
                }
              </code>
            </div>

            <div>
              <span>
                Current custody state
              </span>

              <strong>
                {
                  selectedEvidence.currentStatus
                }
                {" · "}
                {
                  selectedEvidence.currentCustodian
                }
              </strong>
            </div>
          </div>
        )}
      </div>

      {findingsLoad.data && (
        <>
          <FindingTools
            findings={
              findings
            }
            filters={
              filters
            }
            shown={
              filtered.length
            }
            loading={
              findingsLoad.loading
            }
            onChange={
              update
            }
            onApply={
              apply
            }
            onReload={
              findingsLoad.reload
            }
            onExport={() =>
              exportRowsAsCsv(
                "Investigation findings",
                filtered,
                FINDING_CSV_COLUMNS
              )
            }
          />
        </>
      )}

      <div className="finding-review-note">
        <label>
          <span>
            Independent reviewer rationale
          </span>

          <input
            value={
              reviewNote
            }
            maxLength={
              2000
            }
            disabled={
              !canReview ||
              busy
            }
            onChange={(
              event
            ) =>
              setReviewNote(
                event.target.value
              )
            }
          />
        </label>
      </div>

      <div
        className={
          findingsLoad.loading
            ? "investigation-finding-list ui-list-loading"
            : "investigation-finding-list"
        }
      >
        {findingsLoad.data &&
          findings.length ===
            0 && (
          <div className="investigation-finding-empty">
            <FileText
              size={24}
              aria-hidden="true"
            />

            <strong>
              No investigation findings
            </strong>
          </div>
        )}

        {findings.length >
          0 &&
          filtered.length ===
            0 && (
            <EmptyState
              compact
              title="No findings match these filters"
              message="Try a different search or clear the filters."
              action={
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    apply(
                      DEFAULT_FINDING_FILTERS
                    )
                  }
                >
                  Reset filters
                </button>
              }
            />
          )}

        {pageItems.map(
          (
            finding
          ) => (
            <article
              key={
                finding.id
              }
              className="investigation-finding-row"
            >
              <div className="investigation-finding-top">
                <div>
                  <strong>
                    {
                      finding.findingReference
                    }
                    {" · v"}
                    {
                      finding.findingVersion
                    }
                  </strong>

                  <span>
                    {
                      finding.caseNumber
                    }
                    {" · submitted by "}
                    {
                      finding.submittedBy
                    }
                    <span
                      className="ui-wf-age"
                      title={`Submitted ${formatDateTime(
                        finding.submittedAt
                      )} UTC`}
                    >
                      {" · "}
                      {formatRelativeTime(
                        finding.submittedAt
                      )}
                    </span>
                  </span>
                </div>

                <div
                  className={
                    finding.status ===
                    "APPROVED"
                      ? "investigation-finding-status approved"
                      : finding.status ===
                          "REJECTED"
                        ? "investigation-finding-status rejected"
                        : "investigation-finding-status"
                  }
                >
                  {
                    finding.status
                  }
                </div>
              </div>

              <h3>
                {
                  finding.title
                }
              </h3>

              <p>
                {
                  finding.narrative
                }
              </p>

              <div className="finding-lineage-grid">
                <LineageValue
                  label="Evidence"
                  value={
                    finding.evidenceReference
                  }
                />

                <LineageValue
                  label="Evidence review"
                  value={
                    `v${finding.evidenceReviewVersion} · ${shortHash(
                      finding.evidenceReviewId
                    )}`
                  }
                />

                <LineageValue
                  label="Registry"
                  value={
                    shortHash(
                      finding.evidenceRegistryFingerprint
                    )
                  }
                />

                <LineageValue
                  label="Custody head"
                  value={
                    shortHash(
                      finding.evidenceCustodyHeadHash
                    )
                  }
                />
              </div>

              <div
                className={
                  finding.evidenceLineageCurrent
                    ? "finding-lineage-state current"
                    : "finding-lineage-state"
                }
              >
                <ShieldCheck
                  size={12}
                  aria-hidden="true"
                />

                {finding.evidenceLineageCurrent
                  ? "Evidence lineage remains current"
                  : "Historical evidence lineage"}
              </div>

              {finding.status ===
                "PENDING" && (
                <div className="investigation-finding-actions">
                  <ConfirmButton
                    className="secondary-button"
                    confirmLabel="Yes, reject"
                    disabled={
                      !canReview ||
                      busy ||
                      !reviewNote.trim()
                    }
                    onConfirm={() =>
                      void review(
                        finding.id,
                        finding.findingReference,
                        "REJECTED"
                      )
                    }
                  >
                    <XCircle
                      size={12}
                      aria-hidden="true"
                    />

                    Reject
                  </ConfirmButton>

                  <ConfirmButton
                    className="primary-button"
                    confirmLabel="Yes, approve"
                    disabled={
                      !canReview ||
                      busy ||
                      !reviewNote.trim()
                    }
                    onConfirm={() =>
                      void review(
                        finding.id,
                        finding.findingReference,
                        "APPROVED"
                      )
                    }
                  >
                    <CheckCircle2
                      size={12}
                      aria-hidden="true"
                    />

                    Approve
                  </ConfirmButton>
                </div>
              )}

              {finding.reviewedBy && (
                <div className="investigation-finding-review-proof">
                  <CheckCircle2
                    size={12}
                    aria-hidden="true"
                  />

                  Reviewed by
                  {" "}
                  {
                    finding.reviewedBy
                  }
                  {" · "}
                  {
                    finding.findingReviewDecision
                  }
                </div>
              )}
            </article>
          )
        )}
      </div>

      <Pager
        label="Finding pages"
        page={
          safePage
        }
        pageSize={
          PAGE_SIZE
        }
        total={
          filtered.length
        }
        onPage={
          setPage
        }
      />
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
    <div className="investigation-findings-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function LineageValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="finding-lineage-value">
      <span>
        {label}
      </span>

      <code>
        {value}
      </code>
    </div>
  );
}

function shortHash(
  value: string
) {
  if (
    value.length <= 20
  ) {
    return value;
  }

  return `${value.slice(
    0,
    10
  )}…${value.slice(
    -8
  )}`;
}
