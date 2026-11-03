"use client";

import {
  Activity,
  BarChart3,
  CheckCircle2,
  Fingerprint,
  Globe2,
  Network,
  RefreshCw,
  ShieldAlert,
  UserRoundSearch,
  WalletCards,
} from "lucide-react";

import {
  useCallback,
  useMemo,
  useState,
} from "react";

import {
  fetchCustomerRiskAssessments,
  fetchCustomerRiskFactors,
  recalculateCustomerRisk,
  type CustomerRiskAssessment,
  type CustomerRiskFactor,
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
  plural,
} from "@/lib/list-utils";

import {
  useLoad,
} from "@/lib/use-load";

import {
  useIsMounted,
} from "@/lib/wf-common";

import {
  DEFAULT_RISK_FILTERS,
  RISK_CSV_COLUMNS,
  filterRisk,
  latestGenerated,
  riskFacetCounts,
  sortRisk,
  type RiskFilters,
} from "@/lib/wf-risk";

import {
  useAuth,
} from "./auth-context";

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
  RiskTools,
} from "./wf-risk-tools";

interface FactorData {
  assessmentId: string;
  items: CustomerRiskFactor[];
}

const PAGE_SIZE = 15;

const EMPTY_ASSESSMENTS: CustomerRiskAssessment[] = [];

const EMPTY_FACTORS: CustomerRiskFactor[] = [];

export function CustomerRiskDashboard() {
  const {
    hasAnyRole,
  } = useAuth();

  const isMounted =
    useIsMounted();

  const canRecalculate =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const load =
    useLoad(
      fetchCustomerRiskAssessments,
      "Unable to load customer risk assessments."
    );

  const [filters, setFilters] =
    useState<RiskFilters>(
      DEFAULT_RISK_FILTERS
    );

  const [page, setPage] =
    useState(0);

  const [
    selectedAssessmentId,
    setSelectedAssessmentId,
  ] =
    useState<string | null>(
      null
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

  const assessments =
    load.data ??
    EMPTY_ASSESSMENTS;

  const busy =
    action !== null ||
    load.loading;

  const filtered =
    useMemo(
      () =>
        sortRisk(
          filterRisk(
            assessments,
            filters
          ),
          filters.sort
        ),
      [
        assessments,
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

  const activeAssessmentId =
    selectedAssessmentId &&
    filtered.some(
      (assessment) =>
        assessment.id ===
        selectedAssessmentId
    )
      ? selectedAssessmentId
      : filtered[0]?.id ??
        null;

  const selectedAssessment =
    useMemo(
      () =>
        filtered.find(
          (assessment) =>
            assessment.id ===
            activeAssessmentId
        ) ?? null,
      [
        filtered,
        activeAssessmentId,
      ]
    );

  const loadFactors =
    useCallback(
      async (
        signal: AbortSignal
      ): Promise<FactorData | null> => {
        if (
          !activeAssessmentId
        ) {
          return null;
        }

        return {
          assessmentId:
            activeAssessmentId,
          items:
            await fetchCustomerRiskFactors(
              activeAssessmentId,
              signal
            ),
        };
      },
      [
        activeAssessmentId,
      ]
    );

  const factorsLoad =
    useLoad(
      loadFactors,
      "Unable to load risk factors."
    );

  const factors =
    factorsLoad.data
      ?.assessmentId ===
    activeAssessmentId
      ? factorsLoad.data
          .items
      : EMPTY_FACTORS;

  // Counts per band under the other filters: the summary tiles are
  // also the band filter.
  const bandCounts =
    useMemo(
      () =>
        riskFacetCounts(
          assessments,
          filters,
          "band"
        ),
      [
        assessments,
        filters,
      ]
    );

  const latest =
    useMemo(
      () =>
        latestGenerated(
          assessments
        ),
      [
        assessments,
      ]
    );

  function update(
    patch: Partial<RiskFilters>
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
    next: RiskFilters
  ) {
    setFilters(
      next
    );

    setPage(0);
  }

  async function recalculate() {
    if (
      !canRecalculate ||
      busy
    ) {
      return;
    }

    try {
      setAction(
        "recalculate"
      );

      setActionFailure(
        null
      );

      setNotice(
        null
      );

      const batch =
        await recalculateCustomerRisk();

      if (!isMounted()) {
        return;
      }

      setSelectedAssessmentId(
        null
      );

      setPage(0);

      setNotice(
        `Risk recalculated for ${batch.customerCount} ${plural(
          batch.customerCount,
          "customer"
        )} (model ${batch.modelVersion}).`
      );

      load.reload();
    } catch (failure) {
      if (!isMounted()) {
        return;
      }

      setActionFailure(
        failure instanceof Error
          ? failure.message
          : "Unable to recalculate customer risk."
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
      className="panel customer-risk-panel"
      aria-busy={
        load.loading
      }
    >
      <div className="panel-heading customer-risk-heading">
        <div>
          <div className="eyebrow">
            Unified financial-crime risk
          </div>

          <h2>
            Customer risk intelligence
          </h2>

          <p>
            Explainable risk assessments
            combining customer profile,
            watchlist, transaction,
            cross-border, counterparty
            and circular-flow signals.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          disabled={
            !canRecalculate ||
            busy
          }
          title={
            canRecalculate
              ? "Recalculate customer risk"
              : "Senior Analyst or Administrator required"
          }
          onClick={() =>
            void recalculate()
          }
        >
          <RefreshCw
            size={13}
          />

          {action ===
          "recalculate"
            ? "Calculating..."
            : "Recalculate risk"}
        </button>
      </div>

      {actionFailure && (
        <div
          className="customer-risk-error"
          role="alert"
        >
          <ShieldAlert
            size={14}
          />

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

      {load.error &&
        !load.data && (
          <ErrorState
            title="Unable to load customer risk"
            message={
              load.error
            }
            onRetry={
              load.reload
            }
          />
        )}

      {load.error &&
        load.data && (
          <ErrorState
            compact
            title="Could not refresh customer risk"
            message={
              load.error
            }
            onRetry={
              load.reload
            }
          />
        )}

      {!load.error &&
        !load.data && (
          <LoadingState label="Loading customer risk" />
        )}

      {load.data && (
        <>
          <div
            className="risk-band-summary"
            role="group"
            aria-label="Filter by risk band"
          >
            {RISK_TILES.map(
              (tile) => (
                <RiskMetric
                  key={
                    tile.band
                  }
                  label={
                    tile.label
                  }
                  value={
                    bandCounts[
                      tile.band
                    ] ?? 0
                  }
                  icon={
                    tile.icon
                  }
                  active={
                    filters.band ===
                    tile.band
                  }
                  onSelect={() =>
                    update({
                      band:
                        filters.band ===
                        tile.band
                          ? "ALL"
                          : tile.band,
                    })
                  }
                />
              )
            )}
          </div>

          <div className="ui-wf-summary">
            <StackedBar
              label="Customers by risk band"
              segments={RISK_TILES.filter(
                (tile) =>
                  tile.band !==
                  "ALL"
              ).map(
                (tile) => ({
                  key:
                    tile.band,
                  label:
                    tile.label,
                  value:
                    bandCounts[
                      tile.band
                    ] ?? 0,
                  tone:
                    tile.tone,
                })
              )}
            />
          </div>
        </>
      )}

      {load.data &&
        assessments.length >
          0 && (
          <RiskTools
            assessments={
              assessments
            }
            filters={
              filters
            }
            shown={
              filtered.length
            }
            loading={
              load.loading
            }
            note={
              latest && (
                <span
                  className="ui-wf-muted"
                  title={`Generated ${formatDateTime(
                    latest
                  )} UTC`}
                >
                  Latest assessment generated{" "}
                  {formatRelativeTime(
                    latest
                  )}
                </span>
              )
            }
            onChange={
              update
            }
            onApply={
              apply
            }
            onReload={
              load.reload
            }
            onExport={() =>
              exportRowsAsCsv(
                "Customer risk",
                filtered,
                RISK_CSV_COLUMNS
              )
            }
          />
        )}

      {!load.data ? null : assessments.length ===
      0 ? (
        <div className="customer-risk-empty">
          <BarChart3
            size={28}
          />

          <strong>
            No risk assessment yet
          </strong>

          <span>
            Senior analysts can create
            the first explainable customer
            risk snapshot.
          </span>
        </div>
      ) : (
        <div className="customer-risk-layout">
          <div
            className={
              load.loading
                ? "customer-risk-list ui-list-loading"
                : "customer-risk-list"
            }
          >
            {filtered.length ===
              0 && (
              <EmptyState
                compact
                title="No customers match these filters"
                message="Try a different search or clear the filters."
                action={
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      apply(
                        DEFAULT_RISK_FILTERS
                      )
                    }
                  >
                    Reset filters
                  </button>
                }
              />
            )}

            {pageItems.map(
              (assessment) => (
                <button
                  key={
                    assessment.id
                  }
                  type="button"
                  className={
                    activeAssessmentId ===
                    assessment.id
                      ? "customer-risk-row selected"
                      : "customer-risk-row"
                  }
                  aria-current={
                    activeAssessmentId ===
                    assessment.id
                      ? "true"
                      : undefined
                  }
                  onClick={() =>
                    setSelectedAssessmentId(
                      assessment.id
                    )
                  }
                >
                  <RiskScore
                    score={
                      assessment.score
                    }
                    band={
                      assessment.riskBand
                    }
                  />

                  <div className="customer-risk-row-copy">
                    <strong>
                      {
                        assessment
                          .customerName
                      }
                    </strong>

                    <span>
                      {
                        assessment
                          .countryCode
                      }
                      {" · profile "}
                      {
                        assessment
                          .customerRiskTier
                      }
                    </span>
                  </div>

                  <div className="customer-risk-row-meta">
                    <strong>
                      {
                        assessment
                          .riskBand
                      }
                    </strong>

                    <span>
                      {
                        assessment
                          .modelVersion
                      }
                    </span>
                  </div>
                </button>
              )
            )}

            <Pager
              label="Customer risk pages"
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
          </div>

          <div className="customer-risk-detail">
            {selectedAssessment && (
              <>
                <div className="customer-risk-detail-head">
                  <div>
                    <div className="eyebrow">
                      Explainable assessment
                    </div>

                    <h3>
                      {
                        selectedAssessment
                          .customerName
                      }
                    </h3>

                    <p>
                      {
                        selectedAssessment
                          .countryCode
                      }
                      {" · generated "}
                      {formatDateTime(
                        selectedAssessment
                          .generatedAt
                      )}
                      {" UTC ("}
                      {formatRelativeTime(
                        selectedAssessment
                          .generatedAt
                      )}
                      {")"}
                    </p>
                  </div>

                  <RiskScore
                    score={
                      selectedAssessment
                        .score
                    }
                    band={
                      selectedAssessment
                        .riskBand
                    }
                    large
                  />
                </div>

                <div className="customer-risk-meta-grid">
                  <Detail
                    label="Risk band"
                    value={
                      selectedAssessment
                        .riskBand
                    }
                  />

                  <Detail
                    label="Profile tier"
                    value={
                      selectedAssessment
                        .customerRiskTier
                    }
                  />

                  <Detail
                    label="Model"
                    value={
                      selectedAssessment
                        .modelVersion
                    }
                  />

                  <Detail
                    label="Generated by"
                    value={
                      selectedAssessment
                        .generatedBy
                    }
                  />
                </div>

                <div className="risk-factor-heading">
                  <div>
                    <BarChart3
                      size={14}
                    />

                    <strong>
                      Score contributors
                    </strong>
                  </div>

                  <span>
                    {factorsLoad.error
                      ? "Unavailable"
                      : factorsLoad.loading
                        ? "Loading..."
                        : `${factors.length} ${plural(
                            factors.length,
                            "factor"
                          )}`}
                  </span>
                </div>

                {factorsLoad.error && (
                  <ErrorState
                    compact
                    title="Could not load risk factors"
                    message={
                      factorsLoad.error
                    }
                    onRetry={
                      factorsLoad.reload
                    }
                  />
                )}

                {!factorsLoad.error &&
                  factorsLoad.loading && (
                    <LoadingState
                      compact
                      label="Loading risk factors"
                    />
                  )}

                {!factorsLoad.error &&
                  !factorsLoad.loading &&
                  factors.length ===
                    0 && (
                    <EmptyState
                      compact
                      title="No factors recorded"
                      message="This assessment has no stored score contributors."
                    />
                  )}

                <div className="risk-factor-list">
                  {factors.map(
                    (factor) => (
                      <article
                        key={
                          factor.id
                        }
                        className="risk-factor-row"
                      >
                        <div className="risk-factor-icon">
                          {factorIcon(
                            factor.factorKey
                          )}
                        </div>

                        <div className="risk-factor-copy">
                          <div>
                            <strong>
                              {
                                factor.label
                              }
                            </strong>

                            <span>
                              {
                                factor.rawValue
                              }
                            </span>
                          </div>

                          <p>
                            {
                              factor
                                .explanation
                            }
                          </p>
                        </div>

                        <div
                          className={
                            factor.contribution >
                            0
                              ? "risk-factor-contribution active"
                              : "risk-factor-contribution"
                          }
                        >
                          +
                          {
                            factor
                              .contribution
                          }
                        </div>
                      </article>
                    )
                  )}
                </div>

                <div className="risk-model-note">
                  <Fingerprint
                    size={14}
                  />

                  <span>
                    Deterministic,
                    explainable portfolio
                    model. Each assessment
                    preserves its factor
                    contributions for
                    historical review.
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

const RISK_TILES: ReadonlyArray<{
  band: string;
  label: string;
  icon: React.ReactNode;
  tone: "danger" | "warning" | "info" | "ok";
}> = [
  {
    band: "ALL",
    label: "Customers",
    icon: <UserRoundSearch size={15} />,
    tone: "info",
  },
  {
    band: "CRITICAL",
    label: "Critical",
    icon: <ShieldAlert size={15} />,
    tone: "danger",
  },
  {
    band: "HIGH",
    label: "High",
    icon: <Activity size={15} />,
    tone: "warning",
  },
  {
    band: "MEDIUM",
    label: "Medium",
    icon: <BarChart3 size={15} />,
    tone: "info",
  },
  {
    band: "LOW",
    label: "Low",
    icon: <Fingerprint size={15} />,
    tone: "ok",
  },
];

/** A summary tile that also filters the list by its band. */
function RiskMetric({
  label,
  value,
  icon,
  active,
  onSelect,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={
        active
          ? "risk-band-metric ui-wf-metric-btn active"
          : "risk-band-metric ui-wf-metric-btn"
      }
      aria-pressed={active}
      aria-label={`${label}: ${value}`}
      onClick={onSelect}
    >
      <div>
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </button>
  );
}

function RiskScore({
  score,
  band,
  large = false,
}: {
  score: number;
  band: string;
  large?: boolean;
}) {
  return (
    <div
      className={
        `unified-risk-score unified-risk-${band.toLowerCase()} ${
          large
            ? "large"
            : ""
        }`
      }
    >
      <strong>
        {score}
      </strong>

      <span>
        /100
      </span>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="customer-risk-detail-cell">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function factorIcon(
  key: string
) {
  switch (key) {
    case "WATCHLIST_EXPOSURE":
      return (
        <UserRoundSearch
          size={14}
        />
      );

    case "TRANSACTION_VOLUME":
      return (
        <WalletCards
          size={14}
        />
      );

    case "CROSS_BORDER_ACTIVITY":
      return (
        <Globe2
          size={14}
        />
      );

    case "CIRCULAR_FLOW_PARTICIPATION":
      return (
        <Network
          size={14}
        />
      );

    default:
      return (
        <Activity
          size={14}
        />
      );
  }
}
