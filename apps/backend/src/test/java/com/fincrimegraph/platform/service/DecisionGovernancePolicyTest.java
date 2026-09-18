package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DecisionGovernancePolicyTest {

    private final DecisionGovernancePolicy policy =
            new DecisionGovernancePolicy();

    @Test
    void normalizesSupportedRecommendations() {
        assertThat(
                policy.recommendation(" escalate ")
        ).isEqualTo("ESCALATE");

        assertThat(
                policy.recommendation(
                        "continue_investigation"
                )
        ).isEqualTo("CONTINUE_INVESTIGATION");

        assertThat(
                policy.recommendation(
                        "close_no_action"
                )
        ).isEqualTo("CLOSE_NO_ACTION");
    }

    @Test
    void rejectsUnknownRecommendation() {
        assertThatThrownBy(
                () ->
                        policy.recommendation(
                                "UNKNOWN"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "Unsupported recommendation"
                );
    }

    @Test
    void normalizesReviewDecision() {
        assertThat(
                policy.reviewDecision(
                        " approved "
                )
        ).isEqualTo("APPROVED");

        assertThat(
                policy.reviewDecision(
                        "rejected"
                )
        ).isEqualTo("REJECTED");
    }

    @Test
    void preventsSelfReview() {
        assertThatThrownBy(
                () ->
                        policy.requireIndependentReviewer(
                                "senior@fincrime.local",
                                "senior@fincrime.local"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "different from the proposer"
                );
    }

    @Test
    void permitsIndependentReviewer() {
        policy.requireIndependentReviewer(
                "analyst@fincrime.local",
                "senior@fincrime.local"
        );
    }
}
