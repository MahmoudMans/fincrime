"use client";

import {
  Activity,
  BarChart3,
  Fingerprint,
  Globe2,
  Network,
  RefreshCw,
  ShieldAlert,
  UserRoundSearch,
  WalletCards,
} from "lucide-react";

import {
  useEffect,
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
  useAuth,
} from "./auth-context";

interface FactorState {
  assessmentId: string;
  items: CustomerRiskFactor[];
}

export function CustomerRiskDashboard() {
  const {
    hasAnyRole,
  } = useAuth();

  const canRecalculate =
    hasAnyRole(
      "SENIOR_ANALYST",
      "ADMIN"
    );

  const [assessments, setAssessments] =
    useState<
      CustomerRiskAssessment[]
    >([]);

  const [
    selectedAssessmentId,
    setSelectedAssessmentId,
  ] =
    useState<string | null>(
      null
    );

  const [factorState, setFactorState] =
    useState<FactorState | null>(
      null
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

    void fetchCustomerRiskAssessments(
      controller.signal
    )
      .then((items) => {
        setAssessments(
          items
        );

        setError(
          null
        );
      })
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
              : "Unable to load customer risk assessments."
          );
        }
      );

    return () =>
      controller.abort();
  }, []);

  const activeAssessmentId =
    selectedAssessmentId &&
    assessments.some(
      (assessment) =>
        assessment.id ===
        selectedAssessmentId
    )
      ? selectedAssessmentId
      : assessments[0]?.id ??
        null;

  const selectedAssessment =
    useMemo(
      () =>
        assessments.find(
          (assessment) =>
            assessment.id ===
            activeAssessmentId
        ) ?? null,
      [
        assessments,
        activeAssessmentId,
      ]
    );

  useEffect(() => {
    if (!activeAssessmentId) {
      return;
    }

    const controller =
      new AbortController();

    void fetchCustomerRiskFactors(
      activeAssessmentId,
      controller.signal
    )
      .then((items) => {
        setFactorState({
          assessmentId:
            activeAssessmentId,
          items,
        });

        setError(
          null
        );
      })
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
              : "Unable to load risk factors."
          );
        }
      );

    return () =>
      controller.abort();
  }, [
    activeAssessmentId,
  ]);

  const factors =
    useMemo(
      () =>
        factorState?.assessmentId ===
        activeAssessmentId
          ? factorState.items
          : [],
      [
        factorState,
        activeAssessmentId,
      ]
    );

  const bandCounts =
    useMemo(
      () => ({
        critical:
          assessments.filter(
            (assessment) =>
              assessment.riskBand ===
              "CRITICAL"
          ).length,

        high:
          assessments.filter(
            (assessment) =>
              assessment.riskBand ===
              "HIGH"
          ).length,

        medium:
          assessments.filter(
            (assessment) =>
              assessment.riskBand ===
              "MEDIUM"
          ).length,

        low:
          assessments.filter(
            (assessment) =>
              assessment.riskBand ===
              "LOW"
          ).length,
      }),
      [
        assessments,
      ]
    );

  async function recalculate() {
    if (!canRecalculate) {
      return;
    }

    try {
      setAction(
        "recalculate"
      );

      setError(
        null
      );

      const batch =
        await recalculateCustomerRisk();

      setAssessments(
        batch.assessments
      );

      setSelectedAssessmentId(
        batch.assessments[0]
          ?.id ??
        null
      );

      setFactorState(
        null
      );
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unable to recalculate customer risk."
      );
    } finally {
      setAction(
        null
      );
    }
  }

  return (
    <section className="panel customer-risk-panel">
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
            action !== null
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

      {error && (
        <div className="customer-risk-error">
          <ShieldAlert
            size={14}
          />

          {error}
        </div>
      )}

      <div className="risk-band-summary">
        <RiskMetric
          label="Customers"
          value={
            assessments.length
          }
          icon={
            <UserRoundSearch
              size={15}
            />
          }
        />

        <RiskMetric
          label="Critical"
          value={
            bandCounts.critical
          }
          icon={
            <ShieldAlert
              size={15}
            />
          }
        />

        <RiskMetric
          label="High"
          value={
            bandCounts.high
          }
          icon={
            <Activity
              size={15}
            />
          }
        />

        <RiskMetric
          label="Medium"
          value={
            bandCounts.medium
          }
          icon={
            <BarChart3
              size={15}
            />
          }
        />

        <RiskMetric
          label="Low"
          value={
            bandCounts.low
          }
          icon={
            <Fingerprint
              size={15}
            />
          }
        />
      </div>

      {assessments.length ===
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
          <div className="customer-risk-list">
            {assessments.map(
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
                    {
                      factors.length
                    }
                    {" factors"}
                  </span>
                </div>

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

function RiskMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="risk-band-metric">
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
    new Date(value)
  );
}
