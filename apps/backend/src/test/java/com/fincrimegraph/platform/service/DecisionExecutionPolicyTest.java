package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class DecisionExecutionPolicyTest {

    private final DecisionExecutionPolicy policy =
            new DecisionExecutionPolicy();

    @Test
    void mapsRecommendationsToGovernedOutcomes() {

        assertThat(
                policy.outcomeFor(
                        "ESCALATE"
                )
        ).isEqualTo(
                "ESCALATED_FOR_REVIEW"
        );

        assertThat(
                policy.outcomeFor(
                        "continue_investigation"
                )
        ).isEqualTo(
                "CONTINUE_INVESTIGATION"
        );

        assertThat(
                policy.outcomeFor(
                        "close_no_action"
                )
        ).isEqualTo(
                "CLOSED_NO_ACTION"
        );
    }

    @Test
    void rejectsUnsupportedRecommendation() {

        assertThatThrownBy(
                () ->
                        policy.outcomeFor(
                                "UNKNOWN"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "Unsupported approved recommendation"
                );
    }

    @Test
    void onlyApprovedProposalCanExecute() {

        policy.requireApproved(
                "APPROVED"
        );

        assertThatThrownBy(
                () ->
                        policy.requireApproved(
                                "REJECTED"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "Only APPROVED"
                );

        assertThatThrownBy(
                () ->
                        policy.requireApproved(
                                "PENDING"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "Only APPROVED"
                );
    }

    @Test
    void approvedExecutionRequiresReviewAttribution() {

        policy.requireReviewed(
                "senior@fincrime.local"
        );

        assertThatThrownBy(
                () ->
                        policy.requireReviewed(
                                ""
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "independent review"
                );
    }
}
