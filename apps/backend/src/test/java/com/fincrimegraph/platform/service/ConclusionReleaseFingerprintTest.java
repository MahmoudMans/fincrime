package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class ConclusionReleaseFingerprintTest {

    private final ConclusionReleaseFingerprint fingerprint =
            new ConclusionReleaseFingerprint();

    @Test
    void isStableForIdenticalReleaseSnapshot() {

        ConclusionReleaseFingerprint.Snapshot
                snapshot =
                snapshot(
                        "Approved final investigation conclusion."
                );

        String first =
                fingerprint.hash(
                        snapshot
                );

        String second =
                fingerprint.hash(
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
    void changesWhenReleaseContentChanges() {

        String original =
                fingerprint.hash(
                        snapshot(
                                "Approved final investigation conclusion."
                        )
                );

        String modified =
                fingerprint.hash(
                        snapshot(
                                "Modified final investigation conclusion."
                        )
                );

        assertThat(
                modified
        ).isNotEqualTo(
                original
        );
    }

    private ConclusionReleaseFingerprint.Snapshot
    snapshot(
            String conclusionSummary
    ) {
        return new ConclusionReleaseFingerprint.Snapshot(
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000001"
                ),
                1,
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000002"
                ),
                1,
                "FINDING-001",
                "Evidence-backed transaction pattern",
                "Investigation narrative.",
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000003"
                ),
                "senior@fincrime.local",
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000004"
                ),
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000005"
                ),
                1,
                "a".repeat(
                        64
                ),
                "b".repeat(
                        64
                ),
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000006"
                ),
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000007"
                ),
                1,
                "ESCALATED_FOR_REVIEW",
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000008"
                ),
                "c".repeat(
                        64
                ),
                "d".repeat(
                        64
                ),
                conclusionSummary,
                "Release after independent governance review.",
                "senior@fincrime.local"
        );
    }
}
