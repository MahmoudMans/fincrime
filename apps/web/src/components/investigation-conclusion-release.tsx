"use client";

import {
  CheckCircle2,
  FileLock2,
  PackageCheck,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchInvestigationConclusionPackages,
  fetchInvestigationFindings,
  prepareInvestigationConclusionPackage,
  reviewInvestigationConclusionPackage,
  type InvestigationConclusionPackage,
  type InvestigationFinding,
} from "@/lib/api";

import {
  useAuth,
} from "./auth-context";

export function InvestigationConclusionRelease() {
  const {
    hasAnyRole,
  } = useAuth();

  const canPrepare =
    hasAnyRole(
      "SENIOR_ANALYST"
    );

  const canRelease =
    hasAnyRole(
      "ADMIN"
    );

  const [findings, setFindings] =
    useState<
      InvestigationFinding[]
    >([]);

  const [packages, setPackages] =
    useState<
      InvestigationConclusionPackage[]
    >([]);

  const [
    selectedFindingId,
    setSelectedFindingId,
  ] =
    useState<string>("");

  const [
    conclusionSummary,
    setConclusionSummary,
  ] =
    useState(
      "The approved evidence-backed finding supports escalation of the investigated transaction pattern as the governed investigation conclusion."
    );

  const [
    releaseRationale,
    setReleaseRationale,
  ] =
    useState(
      "Prepare the approved investigation conclusion for independent Administrator release review."
    );

  const [
    reviewNote,
    setReviewNote,
  ] =
    useState(
      "Independent Administrator release review completed against the frozen conclusion package provenance."
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
      fetchInvestigationFindings(
        controller.signal
      ),
      fetchInvestigationConclusionPackages(
        controller.signal
      ),
    ])
      .then(
        ([
          loadedFindings,
          loadedPackages,
        ]) => {
          setFindings(
            loadedFindings
          );

          setPackages(
            loadedPackages
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
              : "Unable to load conclusion release governance."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const eligibleFindings =
    useMemo(
      () =>
        findings.filter(
          (
            finding
          ) =>
            finding.status ===
              "APPROVED" &&
            finding.evidenceLineageCurrent
        ),
      [
        findings,
      ]
    );

  const activeFindingId =
    selectedFindingId &&
    eligibleFindings.some(
      (
        item
      ) =>
        item.id ===
        selectedFindingId
    )
      ? selectedFindingId
      : eligibleFindings[0]?.id ??
        "";

  const selectedFinding =
    useMemo(
      () =>
        eligibleFindings.find(
          (
            finding
          ) =>
            finding.id ===
            activeFindingId
        ) ?? null,
      [
        eligibleFindings,
        activeFindingId,
      ]
    );

  const pendingPackages =
    useMemo(
      () =>
        packages.filter(
          (
            item
          ) =>
            item.status ===
            "PENDING"
        ),
      [
        packages,
      ]
    );

  const releasedPackages =
    useMemo(
      () =>
        packages.filter(
          (
            item
          ) =>
            item.status ===
            "RELEASED"
        ),
      [
        packages,
      ]
    );

  async function reload() {
    const [
      loadedFindings,
      loadedPackages,
    ] =
      await Promise.all([
        fetchInvestigationFindings(),
        fetchInvestigationConclusionPackages(),
      ]);

    setFindings(
      loadedFindings
    );

    setPackages(
      loadedPackages
    );
  }

  async function prepare() {
    if (
      !selectedFinding
    ) {
      return;
    }

    try {
      setAction(
        "prepare"
      );

      setError(
        null
      );

      await prepareInvestigationConclusionPackage(
        selectedFinding.id,
        conclusionSummary,
        releaseRationale
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to prepare conclusion package."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  async function review(
    packageId: string,
    decision: string
  ) {
    if (
      !canRelease
    ) {
      return;
    }

    try {
      setAction(
        packageId
      );

      setError(
        null
      );

      await reviewInvestigationConclusionPackage(
        packageId,
        decision,
        reviewNote
      );

      await reload();

    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to review conclusion package."
      );

    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel conclusion-release-panel">
      <div className="panel-heading conclusion-release-heading">
        <div>
          <div className="eyebrow">
            Final investigation governance
          </div>

          <h2>
            Conclusion release governance
          </h2>

          <p>
            Approved findings are packaged
            with their exact finding,
            evidence, governed-outcome and
            attestation provenance before
            independent Administrator
            release.
          </p>
        </div>

        <div className="conclusion-release-badge">
          <FileLock2
            size={13}
          />

          Provenance locked
        </div>
      </div>

      {error && (
        <div className="conclusion-release-error">
          {error}
        </div>
      )}

      <div className="conclusion-release-metrics">
        <Metric
          label="Packages"
          value={
            packages.length
          }
        />

        <Metric
          label="Pending"
          value={
            pendingPackages.length
          }
        />

        <Metric
          label="Released"
          value={
            releasedPackages.length
          }
        />
      </div>

      <div className="conclusion-prepare-card">
        <div className="conclusion-card-heading">
          <div>
            <PackageCheck
              size={14}
            />

            <strong>
              Prepare conclusion package
            </strong>
          </div>

          <span>
            Senior Analyst
          </span>
        </div>

        <div className="conclusion-prepare-grid">
          <label>
            <span>
              Approved finding
            </span>

            <select
              value={
                activeFindingId
              }
              disabled={
                !canPrepare ||
                action !== null
              }
              onChange={(
                event
              ) =>
                setSelectedFindingId(
                  event.target.value
                )
              }
            >
              {eligibleFindings.map(
                (
                  finding
                ) => (
                  <option
                    key={
                      finding.id
                    }
                    value={
                      finding.id
                    }
                  >
                    {
                      finding.findingReference
                    }
                    {" · v"}
                    {
                      finding.findingVersion
                    }
                    {" · "}
                    {
                      finding.caseNumber
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="conclusion-wide">
            <span>
              Conclusion summary
            </span>

            <textarea
              value={
                conclusionSummary
              }
              maxLength={
                4000
              }
              disabled={
                !canPrepare ||
                action !== null
              }
              onChange={(
                event
              ) =>
                setConclusionSummary(
                  event.target.value
                )
              }
            />
          </label>

          <label className="conclusion-wide">
            <span>
              Release rationale
            </span>

            <input
              value={
                releaseRationale
              }
              maxLength={
                2000
              }
              disabled={
                !canPrepare ||
                action !== null
              }
              onChange={(
                event
              ) =>
                setReleaseRationale(
                  event.target.value
                )
              }
            />
          </label>

          <button
            type="button"
            className="primary-button"
            disabled={
              !canPrepare ||
              action !== null ||
              !selectedFinding ||
              !conclusionSummary.trim() ||
              !releaseRationale.trim()
            }
            onClick={() =>
              void prepare()
            }
          >
            <PackageCheck
              size={12}
            />

            {action ===
            "prepare"
              ? "Preparing..."
              : "Prepare package"}
          </button>
        </div>

        {selectedFinding && (
          <div className="conclusion-source-proof">
            <Proof
              label="Finding"
              value={
                `${selectedFinding.findingReference} · v${selectedFinding.findingVersion}`
              }
            />

            <Proof
              label="Finding review"
              value={
                shortHash(
                  selectedFinding.findingReviewId ??
                    ""
                )
              }
            />

            <Proof
              label="Evidence review"
              value={
                `${shortHash(
                  selectedFinding.evidenceReviewId
                )} · v${selectedFinding.evidenceReviewVersion}`
              }
            />

            <Proof
              label="Custody head"
              value={
                shortHash(
                  selectedFinding.evidenceCustodyHeadHash
                )
              }
            />
          </div>
        )}
      </div>

      <div className="conclusion-review-note">
        <label>
          <span>
            Administrator review rationale
          </span>

          <input
            value={
              reviewNote
            }
            maxLength={
              2000
            }
            disabled={
              !canRelease ||
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

      <div className="conclusion-package-list">
        {packages.length ===
          0 && (
          <div className="conclusion-package-empty">
            <FileLock2
              size={24}
            />

            <strong>
              No conclusion packages
            </strong>
          </div>
        )}

        {packages.map(
          (
            item
          ) => (
            <article
              key={
                item.id
              }
              className="conclusion-package-row"
            >
              <div className="conclusion-package-top">
                <div>
                  <strong>
                    {
                      item.caseNumber
                    }
                    {" · package v"}
                    {
                      item.packageVersion
                    }
                  </strong>

                  <span>
                    {
                      item.findingReference
                    }
                    {" · finding v"}
                    {
                      item.findingVersion
                    }
                    {" · prepared by "}
                    {
                      item.preparedBy
                    }
                  </span>
                </div>

                <div
                  className={
                    item.status ===
                    "RELEASED"
                      ? "conclusion-package-status released"
                      : item.status ===
                          "REJECTED"
                        ? "conclusion-package-status rejected"
                        : "conclusion-package-status"
                  }
                >
                  {
                    item.status
                  }
                </div>
              </div>

              <h3>
                {
                  item.findingTitle
                }
              </h3>

              <p>
                {
                  item.conclusionSummary
                }
              </p>

              <div className="conclusion-proof-grid">
                <Proof
                  label="Release fingerprint"
                  value={
                    shortHash(
                      item.releaseFingerprint
                    )
                  }
                />

                <Proof
                  label="Evidence registry"
                  value={
                    shortHash(
                      item.evidenceRegistryFingerprint
                    )
                  }
                />

                <Proof
                  label="Custody head"
                  value={
                    shortHash(
                      item.evidenceCustodyHeadHash
                    )
                  }
                />

                <Proof
                  label="Outcome provenance"
                  value={
                    shortHash(
                      item.outcomeProvenanceHash
                    )
                  }
                />

                <Proof
                  label="Outcome audit anchor"
                  value={
                    shortHash(
                      item.outcomeAuditRootHash
                    )
                  }
                />

                <Proof
                  label="Outcome"
                  value={
                    humanize(
                      item.governedOutcome
                    )
                  }
                />
              </div>

              <div className="conclusion-integrity-row">
                <Integrity
                  label="Fingerprint"
                  valid={
                    item.fingerprintValid
                  }
                />

                <Integrity
                  label="Finding lineage"
                  valid={
                    item.findingLineageCurrent
                  }
                />

                <Integrity
                  label="Outcome provenance"
                  valid={
                    item.outcomeLineageCurrent
                  }
                />
              </div>

              {item.status ===
                "PENDING" && (
                <div className="conclusion-package-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={
                      !canRelease ||
                      action !== null
                    }
                    onClick={() =>
                      void review(
                        item.id,
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
                      !canRelease ||
                      action !== null ||
                      !item.sourceLineageCurrent
                    }
                    onClick={() =>
                      void review(
                        item.id,
                        "RELEASED"
                      )
                    }
                  >
                    <CheckCircle2
                      size={12}
                    />

                    Release
                  </button>
                </div>
              )}

              {item.reviewedBy && (
                <div className="conclusion-review-proof">
                  <ShieldCheck
                    size={12}
                  />

                  Reviewed by
                  {" "}
                  {
                    item.reviewedBy
                  }
                  {" · "}
                  {
                    item.releaseDecision
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
    <div className="conclusion-release-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Proof({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="conclusion-proof">
      <span>
        {label}
      </span>

      <code>
        {value}
      </code>
    </div>
  );
}

function Integrity({
  label,
  valid,
}: {
  label: string;
  valid: boolean;
}) {
  return (
    <div
      className={
        valid
          ? "conclusion-integrity valid"
          : "conclusion-integrity"
      }
    >
      <ShieldCheck
        size={11}
      />

      {label}
      {": "}
      {valid
        ? "valid"
        : "invalid"}
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
