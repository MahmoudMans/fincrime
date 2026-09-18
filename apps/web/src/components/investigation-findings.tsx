"use client";

import {
  CheckCircle2,
  FileCheck2,
  FileText,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useEffect,
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
  useAuth,
} from "./auth-context";

export function InvestigationFindings() {
  const {
    hasAnyRole,
  } = useAuth();

  const canSubmit =
    hasAnyRole(
      "AML_ANALYST"
    );

  const canReview =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [evidence, setEvidence] =
    useState<
      EvidenceCustodyRecord[]
    >([]);

  const [
    evidenceReviews,
    setEvidenceReviews,
  ] =
    useState<
      EvidenceReviewRecord[]
    >([]);

  const [
    findings,
    setFindings,
  ] =
    useState<
      InvestigationFinding[]
    >([]);

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

  const [error, setError] =
    useState<string | null>(
      null
    );

  useEffect(() => {
    const controller =
      new AbortController();

    void Promise.all([
      fetchEvidenceCustodyRegistry(
        controller.signal
      ),
      fetchEvidenceReviews(
        controller.signal
      ),
      fetchInvestigationFindings(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedEvidence,
          loadedReviews,
          loadedFindings,
        ]) => {
          setEvidence(
            loadedEvidence
          );

          setEvidenceReviews(
            loadedReviews
          );

          setFindings(
            loadedFindings
          );

          setError(
            null
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
              : "Unable to load investigation findings."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

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

  async function reload() {
    const [
      loadedEvidence,
      loadedReviews,
      loadedFindings,
    ] =
      await Promise.all([
        fetchEvidenceCustodyRegistry(),
        fetchEvidenceReviews(),
        fetchInvestigationFindings(),
      ]);

    setEvidence(
      loadedEvidence
    );

    setEvidenceReviews(
      loadedReviews
    );

    setFindings(
      loadedFindings
    );
  }

  async function submit() {
    if (
      !selectedEvidence
    ) {
      return;
    }

    try {
      setAction(
        "submit"
      );

      setError(
        null
      );

      await submitInvestigationFinding(
        selectedEvidence.caseId,
        findingReference,
        title,
        narrative,
        selectedEvidence.id
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to submit investigation finding."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  async function review(
    findingId: string,
    decision: string
  ) {
    if (
      !canReview
    ) {
      return;
    }

    try {
      setAction(
        findingId
      );

      setError(
        null
      );

      await reviewInvestigationFinding(
        findingId,
        decision,
        reviewNote
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to review investigation finding."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel investigation-findings-panel">
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
          />

          Evidence lineage locked
        </div>
      </div>

      {error && (
        <div className="investigation-findings-error">
          {error}
        </div>
      )}

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

      <div className="finding-submit-card">
        <div className="finding-card-heading">
          <div>
            <FileText
              size={14}
            />

            <strong>
              Submit evidence-backed finding
            </strong>
          </div>

          <span>
            Analyst maker
          </span>
        </div>

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
                action !== null
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
                action !== null
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
                action !== null
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
                action !== null
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
              action !== null ||
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
              action !== null
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

      <div className="investigation-finding-list">
        {findings.length ===
          0 && (
          <div className="investigation-finding-empty">
            <FileText
              size={24}
            />

            <strong>
              No investigation findings
            </strong>
          </div>
        )}

        {findings.map(
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
                />

                {finding.evidenceLineageCurrent
                  ? "Evidence lineage remains current"
                  : "Historical evidence lineage"}
              </div>

              {finding.status ===
                "PENDING" && (
                <div className="investigation-finding-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      !canReview ||
                      action !== null
                    }
                    onClick={() =>
                      void review(
                        finding.id,
                        "REJECTED"
                      )
                    }
                  >
                    <XCircle
                      size={12}
                    />

                    Reject
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={
                      !canReview ||
                      action !== null
                    }
                    onClick={() =>
                      void review(
                        finding.id,
                        "APPROVED"
                      )
                    }
                  >
                    <CheckCircle2
                      size={12}
                    />

                    Approve
                  </button>
                </div>
              )}

              {finding.reviewedBy && (
                <div className="investigation-finding-review-proof">
                  <CheckCircle2
                    size={12}
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
