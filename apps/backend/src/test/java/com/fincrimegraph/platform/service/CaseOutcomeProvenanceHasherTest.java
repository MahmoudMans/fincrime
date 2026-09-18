package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CaseOutcomeProvenanceHasherTest {

    private final CaseOutcomeProvenanceHasher hasher =
            new CaseOutcomeProvenanceHasher();

    @Test
    void producesStableSha256Fingerprint() {

        CaseOutcomeProvenanceHasher.ProvenanceSnapshot
                snapshot =
                snapshot(
                        "Execute approved outcome."
                );

        String first =
                hasher.hash(
                        snapshot
                );

        String second =
                hasher.hash(
                        snapshot
                );

        assertThat(
                first
        )
                .hasSize(
                        64
                )
                .matches(
                        "[0-9a-f]{64}"
                )
                .isEqualTo(
                        second
                );
    }

    @Test
    void changingExecutionEvidenceChangesFingerprint() {

        String original =
                hasher.hash(
                        snapshot(
                                "Execute approved outcome."
                        )
                );

        String modified =
                hasher.hash(
                        snapshot(
                                "Modified execution evidence."
                        )
                );

        assertThat(
                modified
        ).isNotEqualTo(
                original
        );
    }

    private CaseOutcomeProvenanceHasher.ProvenanceSnapshot
    snapshot(
            String executionNote
    ) {
        return new CaseOutcomeProvenanceHasher.ProvenanceSnapshot(
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000001"
                ),
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000002"
                ),
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000003"
                ),
                1,
                "ESCALATE",
                "ESCALATED_FOR_REVIEW",
                "analyst@fincrime.local",
                "senior@fincrime.local",
                executionNote,
                "admin@fincrime.local",
                Instant.parse(
                        "2026-09-18T20:00:00Z"
                )
        );
    }
}
