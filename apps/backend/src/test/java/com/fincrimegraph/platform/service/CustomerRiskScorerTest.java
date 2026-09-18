package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.CustomerRiskAssessmentEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class CustomerRiskScorerTest {

    private final CustomerRiskScorer scorer =
            new CustomerRiskScorer();

    @Test
    void producesCriticalExplainableScoreForCombinedSignals() {

        CustomerRiskScorer.RiskScore result =
                scorer.score(
                        new CustomerRiskScorer.RiskInput(
                                "HIGH",
                                2,
                                100,
                                "PENDING_REVIEW",
                                8,
                                new BigDecimal(
                                        "65000"
                                ),
                                4,
                                2,
                                true
                        )
                );

        assertThat(
                result.score()
        ).isEqualTo(
                100
        );

        assertThat(
                result.riskBand()
        ).isEqualTo(
                CustomerRiskAssessmentEntity
                        .RiskBand
                        .CRITICAL
        );

        assertThat(
                result.factors()
        ).hasSize(
                6
        );

        assertThat(
                result.factors()
        )
                .extracting(
                        CustomerRiskScorer
                                .Factor
                                ::factorKey
                )
                .containsExactly(
                        "CUSTOMER_PROFILE",
                        "WATCHLIST_EXPOSURE",
                        "TRANSACTION_VOLUME",
                        "CROSS_BORDER_ACTIVITY",
                        "HIGH_RISK_COUNTERPARTIES",
                        "CIRCULAR_FLOW_PARTICIPATION"
                );

        assertThat(
                result.factors()
        )
                .filteredOn(
                        factor ->
                                factor.factorKey()
                                        .equals(
                                                "WATCHLIST_EXPOSURE"
                                        )
                )
                .singleElement()
                .extracting(
                        CustomerRiskScorer
                                .Factor
                                ::contribution
                )
                .isEqualTo(
                        30
                );
    }

    @Test
    void producesLowRiskForMinimalSignals() {

        CustomerRiskScorer.RiskScore result =
                scorer.score(
                        new CustomerRiskScorer.RiskInput(
                                "LOW",
                                0,
                                0,
                                "NONE",
                                1,
                                new BigDecimal(
                                        "100"
                                ),
                                0,
                                0,
                                false
                        )
                );

        assertThat(
                result.score()
        ).isEqualTo(
                10
        );

        assertThat(
                result.riskBand()
        ).isEqualTo(
                CustomerRiskAssessmentEntity
                        .RiskBand
                        .LOW
        );

        assertThat(
                result.factors()
        ).hasSize(
                6
        );
    }
}
