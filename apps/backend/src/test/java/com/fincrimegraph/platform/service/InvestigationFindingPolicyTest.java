package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvestigationFindingPolicyTest {

    private final InvestigationFindingPolicy policy =
            new InvestigationFindingPolicy();

    @Test
    void acceptsCurrentAcceptedEvidenceLineage() {

        policy.requireAcceptedEvidenceReview(
                "VERIFIED",
                "ACCEPTED_FOR_ANALYSIS",
                true
        );
    }

    @Test
    void rejectsUnverifiedEvidence() {

        assertThatThrownBy(
                () ->
                        policy.requireAcceptedEvidenceReview(
                                "TRANSFERRED",
                                "ACCEPTED_FOR_ANALYSIS",
                                true
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "integrity-verified evidence"
                );
    }

    @Test
    void rejectsEvidenceNotAcceptedForAnalysis() {

        assertThatThrownBy(
                () ->
                        policy.requireAcceptedEvidenceReview(
                                "VERIFIED",
                                "QUESTIONED",
                                true
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "accepted for analytical use"
                );
    }

    @Test
    void rejectsHistoricalEvidenceLineage() {

        assertThatThrownBy(
                () ->
                        policy.requireAcceptedEvidenceReview(
                                "VERIFIED",
                                "ACCEPTED_FOR_ANALYSIS",
                                false
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "current evidence lineage"
                );
    }

    @Test
    void normalizesFindingReviewDecisions() {

        assertThat(
                policy.reviewDecision(
                        " approved "
                )
        ).isEqualTo(
                "APPROVED"
        );

        assertThat(
                policy.reviewDecision(
                        "rejected"
                )
        ).isEqualTo(
                "REJECTED"
        );
    }

    @Test
    void rejectsFindingSelfReview() {

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
                        "different from the finding submitter"
                );
    }

    @Test
    void permitsIndependentFindingReviewer() {

        policy.requireIndependentReviewer(
                "analyst@fincrime.local",
                "senior@fincrime.local"
        );
    }
}
