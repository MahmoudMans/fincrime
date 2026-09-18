package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.CustomerRiskAssessmentEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Component
public class CustomerRiskScorer {

    public static final String MODEL_VERSION =
            "RISK-V1";

    public RiskScore score(
            RiskInput input
    ) {
        Factor customerProfile =
                customerProfile(
                        input.customerRiskTier()
                );

        Factor watchlist =
                watchlistExposure(
                        input.watchlistHitCount(),
                        input.maxWatchlistScore(),
                        input.watchlistReviewState()
                );

        Factor transactionVolume =
                transactionVolume(
                        input.transactionCount(),
                        input.totalTransactionVolume()
                );

        Factor crossBorder =
                crossBorderExposure(
                        input.crossBorderTransactionCount()
                );

        Factor highRiskCounterparties =
                highRiskCounterparties(
                        input.highRiskCounterpartyCount()
                );

        Factor circularFlow =
                circularFlowParticipation(
                        input.circularFlowParticipant()
                );

        List<Factor> factors =
                List.of(
                        customerProfile,
                        watchlist,
                        transactionVolume,
                        crossBorder,
                        highRiskCounterparties,
                        circularFlow
                );

        int rawScore =
                factors
                        .stream()
                        .mapToInt(
                                Factor::contribution
                        )
                        .sum();

        int score =
                Math.min(
                        100,
                        rawScore
                );

        return new RiskScore(
                score,
                band(
                        score
                ),
                factors
        );
    }

    private Factor customerProfile(
            String riskTier
    ) {
        String normalized =
                normalize(
                        riskTier,
                        "LOW"
                );

        int contribution =
                switch (normalized) {
                    case "HIGH" -> 35;
                    case "MEDIUM" -> 20;
                    default -> 10;
                };

        return new Factor(
                "CUSTOMER_PROFILE",
                "Customer profile risk",
                normalized,
                contribution,
                "Existing KYC/customer risk classification contributes "
                        + contribution
                        + " points."
        );
    }

    private Factor watchlistExposure(
            int hitCount,
            int maxScore,
            String reviewState
    ) {
        String normalizedState =
                normalize(
                        reviewState,
                        "NONE"
                );

        int contribution;

        if (
                "ESCALATED".equals(
                        normalizedState
                )
        ) {
            contribution = 35;

        } else if (
                "PENDING_REVIEW".equals(
                        normalizedState
                )
        ) {
            contribution =
                    maxScore >= 95
                            ? 30
                            : 25;

        } else if (
                "CLEARED".equals(
                        normalizedState
                )
        ) {
            contribution =
                    hitCount > 0
                            ? 5
                            : 0;

        } else {
            contribution = 0;
        }

        return new Factor(
                "WATCHLIST_EXPOSURE",
                "Watchlist screening exposure",
                "hits="
                        + hitCount
                        + ",maxScore="
                        + maxScore
                        + ",state="
                        + normalizedState,
                contribution,
                "Synthetic watchlist matches contribute according to "
                        + "match strength and current analyst review state."
        );
    }

    private Factor transactionVolume(
            int transactionCount,
            BigDecimal totalVolume
    ) {
        BigDecimal volume =
                totalVolume == null
                        ? BigDecimal.ZERO
                        : totalVolume;

        int contribution;

        if (
                volume.compareTo(
                        new BigDecimal(
                                "50000"
                        )
                ) >= 0
        ) {
            contribution = 15;

        } else if (
                volume.compareTo(
                        new BigDecimal(
                                "25000"
                        )
                ) >= 0
        ) {
            contribution = 10;

        } else if (
                volume.compareTo(
                        new BigDecimal(
                                "10000"
                        )
                ) >= 0
        ) {
            contribution = 5;

        } else {
            contribution = 0;
        }

        return new Factor(
                "TRANSACTION_VOLUME",
                "Transaction exposure",
                "count="
                        + transactionCount
                        + ",volume="
                        + volume.stripTrailingZeros()
                                .toPlainString(),
                contribution,
                "Aggregate transaction exposure contributes up to 15 points."
        );
    }

    private Factor crossBorderExposure(
            int crossBorderCount
    ) {
        int contribution =
                crossBorderCount >= 3
                        ? 10
                        : (
                        crossBorderCount >= 1
                                ? 5
                                : 0
                );

        return new Factor(
                "CROSS_BORDER_ACTIVITY",
                "Cross-border activity",
                "count="
                        + crossBorderCount,
                contribution,
                "Cross-border transaction participation contributes "
                        + contribution
                        + " points."
        );
    }

    private Factor highRiskCounterparties(
            int count
    ) {
        int contribution =
                count >= 2
                        ? 10
                        : (
                        count == 1
                                ? 5
                                : 0
                );

        return new Factor(
                "HIGH_RISK_COUNTERPARTIES",
                "High-risk counterparties",
                "count="
                        + count,
                contribution,
                "Transfers involving high-risk counterparties contribute "
                        + contribution
                        + " points."
        );
    }

    private Factor circularFlowParticipation(
            boolean participant
    ) {
        int contribution =
                participant
                        ? 15
                        : 0;

        return new Factor(
                "CIRCULAR_FLOW_PARTICIPATION",
                "Circular-flow participation",
                Boolean.toString(
                        participant
                ),
                contribution,
                participant
                        ? "At least one customer account participates in a "
                        + "three-hop circular transfer path."
                        : "No three-hop circular transfer participation detected."
        );
    }

    private CustomerRiskAssessmentEntity.RiskBand
    band(
            int score
    ) {
        if (
                score >= 80
        ) {
            return CustomerRiskAssessmentEntity
                    .RiskBand
                    .CRITICAL;
        }

        if (
                score >= 60
        ) {
            return CustomerRiskAssessmentEntity
                    .RiskBand
                    .HIGH;
        }

        if (
                score >= 35
        ) {
            return CustomerRiskAssessmentEntity
                    .RiskBand
                    .MEDIUM;
        }

        return CustomerRiskAssessmentEntity
                .RiskBand
                .LOW;
    }

    private String normalize(
            String value,
            String fallback
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return fallback;
        }

        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    public record RiskInput(
            String customerRiskTier,
            int watchlistHitCount,
            int maxWatchlistScore,
            String watchlistReviewState,
            int transactionCount,
            BigDecimal totalTransactionVolume,
            int crossBorderTransactionCount,
            int highRiskCounterpartyCount,
            boolean circularFlowParticipant
    ) {
    }

    public record Factor(
            String factorKey,
            String label,
            String rawValue,
            int contribution,
            String explanation
    ) {
    }

    public record RiskScore(
            int score,
            CustomerRiskAssessmentEntity.RiskBand riskBand,
            List<Factor> factors
    ) {
    }
}
