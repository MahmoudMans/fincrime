package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class EvidenceIntegrityHasherTest {

    private final EvidenceIntegrityHasher hasher =
            new EvidenceIntegrityHasher();

    @Test
    void registryFingerprintIsStableAndTamperSensitive() {

        EvidenceIntegrityHasher.EvidenceSnapshot
                original =
                evidence(
                        "Original investigation evidence."
                );

        EvidenceIntegrityHasher.EvidenceSnapshot
                modified =
                evidence(
                        "Modified investigation evidence."
                );

        String first =
                hasher.registryFingerprint(
                        original
                );

        String second =
                hasher.registryFingerprint(
                        original
                );

        String tampered =
                hasher.registryFingerprint(
                        modified
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
                )
                .isNotEqualTo(
                        tampered
                );
    }

    @Test
    void custodyEventsDependOnPreviousHash() {

        UUID evidenceId =
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000010"
                );

        String registryFingerprint =
                hasher.registryFingerprint(
                        evidence(
                                "Original investigation evidence."
                        )
                );

        EvidenceIntegrityHasher.CustodyEventSnapshot
                first =
                new EvidenceIntegrityHasher.CustodyEventSnapshot(
                        evidenceId,
                        1,
                        "REGISTERED",
                        null,
                        "analyst@fincrime.local",
                        "analyst@fincrime.local",
                        "Evidence registered.",
                        registryFingerprint,
                        Instant.parse(
                                "2026-09-18T20:00:00Z"
                        )
                );

        String firstHash =
                hasher.custodyEventHash(
                        EvidenceIntegrityHasher.GENESIS_HASH,
                        first
                );

        EvidenceIntegrityHasher.CustodyEventSnapshot
                second =
                new EvidenceIntegrityHasher.CustodyEventSnapshot(
                        evidenceId,
                        2,
                        "TRANSFERRED",
                        "analyst@fincrime.local",
                        "admin@fincrime.local",
                        "senior@fincrime.local",
                        "Custody transfer.",
                        registryFingerprint,
                        Instant.parse(
                                "2026-09-18T20:05:00Z"
                        )
                );

        String correctlyLinked =
                hasher.custodyEventHash(
                        firstHash,
                        second
                );

        String incorrectlyLinked =
                hasher.custodyEventHash(
                        EvidenceIntegrityHasher.GENESIS_HASH,
                        second
                );

        assertThat(
                firstHash
        )
                .hasSize(
                        64
                )
                .matches(
                        "[0-9a-f]{64}"
                );

        assertThat(
                correctlyLinked
        )
                .hasSize(
                        64
                )
                .isNotEqualTo(
                        incorrectlyLinked
                );
    }

    private EvidenceIntegrityHasher.EvidenceSnapshot
    evidence(
            String description
    ) {
        return new EvidenceIntegrityHasher.EvidenceSnapshot(
                UUID.fromString(
                        "00000000-0000-0000-0000-000000000001"
                ),
                "EVIDENCE-001",
                "TRANSACTION_EXPORT",
                "Synthetic transaction evidence",
                "local://synthetic/transactions.csv",
                description,
                "a".repeat(
                        64
                )
        );
    }
}
