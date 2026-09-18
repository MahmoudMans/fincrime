package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EvidenceReviewPolicyTest {

    private final EvidenceReviewPolicy policy =
            new EvidenceReviewPolicy();

    @Test
    void normalizesSupportedDecisions() {

        assertThat(
                policy.decision(
                        " accepted_for_analysis "
                )
        ).isEqualTo(
                "ACCEPTED_FOR_ANALYSIS"
        );

        assertThat(
                policy.decision(
                        "questioned"
                )
        ).isEqualTo(
                "QUESTIONED"
        );

        assertThat(
                policy.decision(
                        "excluded"
                )
        ).isEqualTo(
                "EXCLUDED"
        );
    }

    @Test
    void rejectsUnsupportedDecision() {

        assertThatThrownBy(
                () ->
                        policy.decision(
                                "UNKNOWN"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "Unsupported evidence review decision"
                );
    }

    @Test
    void requiresIntegrityVerifiedEvidence() {

        policy.requireVerifiedEvidence(
                "VERIFIED"
        );

        assertThatThrownBy(
                () ->
                        policy.requireVerifiedEvidence(
                                "TRANSFERRED"
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
    void requiresReviewerDifferentFromCurrentCustodian() {

        policy.requireIndependentReviewer(
                "admin@fincrime.local",
                "senior@fincrime.local"
        );

        assertThatThrownBy(
                () ->
                        policy.requireIndependentReviewer(
                                "admin@fincrime.local",
                                "admin@fincrime.local"
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "different from the current custodian"
                );
    }
}
