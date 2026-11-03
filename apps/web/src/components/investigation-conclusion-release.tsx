"use client";

import {
  FileLock2,
  PackageCheck,
  ShieldCheck,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  fetchInvestigationConclusionPackages,
  fetchInvestigationFindings,
  prepareInvestigationConclusionPackage,
  reviewInvestigationConclusionPackage,
} from "@/lib/api";

import {
  dataChecks,
  DEFAULT_RELEASE_FILTERS,
  filterReleases,
  prepareBlockers,
  type ReleaseFilters,
} from "@/lib/ev-release";

import { useActionRunner } from "@/lib/ev-hooks";

import { formatDateTime, humanize } from "@/lib/format";

import { clampPage, paginate } from "@/lib/list-utils";

import { useLoad } from "@/lib/use-load";

import {
  useAuth,
} from "./auth-context";

import {
  PendingReview,
  ReleaseFilterBar,
} from "./ev-release-parts";

import {
  ErrorBanner,
  SuccessBanner,
} from "./ev-ui";

import { Pager } from "./list-tools";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "./state-card";

const PACKAGE_PAGE_SIZE = 10;

/** Both lists the screen needs, loaded together. */
function fetchRelease(
  signal: AbortSignal
) {
  return Promise.all([
    fetchInvestigationFindings(
      signal
    ),
    fetchInvestigationConclusionPackages(
      signal
    ),
  ]).then(
    ([
      findings,
      packages,
    ]) => ({
      findings,
      packages,
    })
  );
}

export function InvestigationConclusionRelease() {
  const {
    session,
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

  const load =
    useLoad(
      fetchRelease,
      "Unable to load conclusion release governance."
    );

  const findings =
    useMemo(
      () =>
        load.data?.findings ??
        [],
      [
        load.data,
      ]
    );

  const packages =
    useMemo(
      () =>
        load.data?.packages ??
        [],
      [
        load.data,
      ]
    );

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

  const [filters, setFilters] =
    useState<ReleaseFilters>(
      DEFAULT_RELEASE_FILTERS
    );

  const [page, setPage] =
    useState(
      0
    );

  const [notice, setNotice] =
    useState<string | null>(
      null
    );

  const {
    busy: action,
    error,
    errorKey,
    clearError,
    run,
  } =
    useActionRunner();

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

  const filteredPackages =
    useMemo(
      () =>
        filterReleases(
          packages,
          filters
        ),
      [
        packages,
        filters,
      ]
    );

  const safePage =
    clampPage(
      page,
      filteredPackages.length,
      PACKAGE_PAGE_SIZE
    );

  const pagePackages =
    paginate(
      filteredPackages,
      safePage,
      PACKAGE_PAGE_SIZE
    );

  const prepareProblems =
    prepareBlockers(
      {
        canPrepare,
        finding:
          selectedFinding,
        packages,
      }
    );

  function updateFilters(
    patch: Partial<ReleaseFilters>
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
      DEFAULT_RELEASE_FILTERS
    );

    setPage(
      0
    );
  }

  function applyFilters(
    next: ReleaseFilters
  ) {
    setFilters(
      next
    );

    setPage(
      0
    );
  }

  async function prepare() {
    if (
      !selectedFinding ||
      prepareProblems.length > 0
    ) {
      return;
    }

    const findingId =
      selectedFinding.id;

    setNotice(
      null
    );

    await run(
      "prepare",
      () =>
        prepareInvestigationConclusionPackage(
          findingId,
          conclusionSummary.trim(),
          releaseRationale.trim()
        ),
      "Unable to prepare conclusion package.",
      (created) => {
        setNotice(
          `Prepared package v${created.packageVersion} for ${created.caseNumber}. It now waits for Administrator release review.`
        );

        load.reload();
      }
    );
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

    setNotice(
      null
    );

    await run(
      `review:${packageId}:${decision}`,
      () =>
        reviewInvestigationConclusionPackage(
          packageId,
          decision,
          reviewNote.trim()
        ),
      "Unable to review conclusion package.",
      (reviewed) => {
        setNotice(
          `Package v${reviewed.packageVersion} for ${reviewed.caseNumber} is now ${humanize(
            reviewed.status
          ).toLowerCase()}.`
        );

        load.reload();
      }
    );
  }

  return (
    <section
      className="panel conclusion-release-panel"
      aria-busy={load.loading}
    >
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

      {notice && (
        <SuccessBanner
          message={notice}
          onDismiss={() =>
            setNotice(null)
          }
        />
      )}

      {load.error && (
        <ErrorState
          compact
          title="Unable to load conclusion packages"
          message={load.error}
          onRetry={load.reload}
        />
      )}

      {load.data === null &&
        load.loading && (
          <LoadingState
            compact
            label="Loading conclusion packages"
          />
        )}

      {load.data !== null && (
      <>
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
              action !== null ||
              !selectedFinding ||
              prepareProblems.length > 0 ||
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

        {eligibleFindings.length === 0 && (
          <p className="ui-ev-hint">
            No approved finding with current evidence lineage is
            available. A finding has to be approved in Findings
            before a conclusion package can be prepared.
          </p>
        )}

        {prepareProblems.length > 0 &&
          selectedFinding && (
            <div
              className="ui-notice"
              role="status"
            >
              <ShieldCheck
                size={15}
                aria-hidden="true"
              />

              <div>
                <strong>
                  A package cannot be prepared yet
                </strong>

                <ul className="ui-ev-blockers">
                  {prepareProblems.map(
                    (
                      problem
                    ) => (
                      <li
                        key={
                          problem
                        }
                      >
                        {
                          problem
                        }
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          )}

        {error &&
          errorKey ===
            "prepare" && (
            <ErrorBanner
              message={error}
              onDismiss={clearError}
            />
          )}

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

      {packages.length > 0 && (
        <ReleaseFilterBar
          packages={packages}
          filters={filters}
          filtered={filteredPackages}
          refreshing={
            load.loading
          }
          onChange={updateFilters}
          onReset={resetFilters}
          onApply={applyFilters}
          onRefresh={load.reload}
        />
      )}

      <div className="conclusion-package-list">
        {packages.length ===
          0 && (
          <EmptyState
            compact
            icon={
              <FileLock2
                size={24}
                aria-hidden="true"
              />
            }
            title="No conclusion packages"
            message="Prepare a package from an approved finding above. An Administrator then reviews it for release."
          />
        )}

        {packages.length > 0 &&
          filteredPackages.length === 0 && (
            <EmptyState
              compact
              title="No packages match these filters"
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

        {pagePackages.map(
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
                  {humanize(
                    item.status
                  )}
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

              {item.status ===
              "PENDING" ? (
                <PendingReview
                  item={item}
                  canRelease={
                    canRelease
                  }
                  username={
                    session.username
                  }
                  reviewNote={
                    reviewNote
                  }
                  action={action}
                  onDecide={
                    review
                  }
                />
              ) : (
                <div className="conclusion-integrity-row">
                  {dataChecks(
                    item
                  ).map(
                    (
                      check
                    ) => (
                      <Integrity
                        key={
                          check.key
                        }
                        label={
                          check.label
                        }
                        valid={
                          check.ok
                        }
                      />
                    )
                  )}
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
                  {humanize(
                    item.releaseDecision ??
                      ""
                  )}
                  {item.reviewedAt &&
                    ` · ${formatDateTime(item.reviewedAt)} UTC`}
                </div>
              )}
            </article>
          )
        )}

        <Pager
          page={safePage}
          pageSize={PACKAGE_PAGE_SIZE}
          total={filteredPackages.length}
          label="Conclusion package pages"
          onPage={setPage}
        />
      </div>

      {error &&
        errorKey !== "prepare" && (
          <ErrorBanner
            message={error}
            onDismiss={clearError}
          />
        )}
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
