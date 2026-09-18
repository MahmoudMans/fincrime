package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InvestigationConclusionReleasePolicyTest {

    private final InvestigationConclusionReleasePolicy policy =
            new InvestigationConclusionReleasePolicy();

    @Test
    void requiresApprovedFindingWithCurrentLineage() {

        policy.requireApprovedFinding(
                "APPROVED",
                true
        );

        assertThatThrownBy(
                () ->
                        policy.requireApprovedFinding(
                                "REJECTED",
                                true
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "APPROVED investigation finding"
                );

        assertThatThrownBy(
                () ->
                        policy.requireApprovedFinding(
                                "APPROVED",
                                false
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "evidence lineage is still current"
                );
    }

    @Test
    void normalizesReleaseDecisions() {

        assertThat(
                policy.decision(
                        " released "
                )
        ).isEqualTo(
                "RELEASED"
        );

        assertThat(
                policy.decision(
                        "rejected"
                )
        ).isEqualTo(
                "REJECTED"
        );
    }

    @Test
    void rejectsUnsupportedReleaseDecision() {

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
                        "Unsupported conclusion release decision"
                );
    }

    @Test
    void requiresIndependentReleaseReviewer() {

        policy.requireIndependentReviewer(
                "senior@fincrime.local",
                "admin@fincrime.local"
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
                        "different from the package preparer"
                );
    }

    @Test
    void requiresAllIntegritySignalsForRelease() {

        policy.requireReleasableIntegrity(
                true,
                true,
                true
        );

        assertThatThrownBy(
                () ->
                        policy.requireReleasableIntegrity(
                                false,
                                true,
                                true
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "fingerprint verification failed"
                );

        assertThatThrownBy(
                () ->
                        policy.requireReleasableIntegrity(
                                true,
                                false,
                                true
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "finding/evidence lineage"
                );

        assertThatThrownBy(
                () ->
                        policy.requireReleasableIntegrity(
                                true,
                                true,
                                false
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "governed-outcome provenance"
                );
    }
}
