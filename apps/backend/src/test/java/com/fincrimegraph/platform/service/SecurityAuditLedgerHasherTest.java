package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityAuditLedgerHasherTest {

    private final SecurityAuditLedgerHasher hasher =
            new SecurityAuditLedgerHasher();

    @Test
    void createsDeterministicTamperSensitiveChain() {

        SecurityAuditLedgerHasher.AuditEvent first =
                event(
                        "00000000-0000-0000-0000-000000000001",
                        "LOGIN_SUCCESS",
                        "SUCCESS",
                        "Authentication succeeded."
                );

        SecurityAuditLedgerHasher.AuditEvent second =
                event(
                        "00000000-0000-0000-0000-000000000002",
                        "AML_DETECTION_RUN",
                        "SUCCESS",
                        "AML detection completed."
                );

        String firstEventHash =
                hasher.eventHash(
                        first
                );

        String firstChain =
                hasher.chainHash(
                        SecurityAuditLedgerHasher
                                .GENESIS_HASH,
                        firstEventHash
                );

        String secondEventHash =
                hasher.eventHash(
                        second
                );

        String secondChain =
                hasher.chainHash(
                        firstChain,
                        secondEventHash
                );

        assertThat(
                firstEventHash
        )
                .hasSize(
                        64
                )
                .matches(
                        "[0-9a-f]{64}"
                );

        assertThat(
                firstChain
        )
                .hasSize(
                        64
                )
                .isNotEqualTo(
                        firstEventHash
                );

        assertThat(
                secondChain
        )
                .hasSize(
                        64
                )
                .isNotEqualTo(
                        firstChain
                );

        assertThat(
                hasher.chainHash(
                        firstChain,
                        secondEventHash
                )
        ).isEqualTo(
                secondChain
        );

        SecurityAuditLedgerHasher.AuditEvent tampered =
                event(
                        "00000000-0000-0000-0000-000000000002",
                        "AML_DETECTION_RUN",
                        "SUCCESS",
                        "Tampered audit detail."
                );

        String tamperedHash =
                hasher.eventHash(
                        tampered
                );

        assertThat(
                tamperedHash
        ).isNotEqualTo(
                secondEventHash
        );

        assertThat(
                hasher.chainHash(
                        firstChain,
                        tamperedHash
                )
        ).isNotEqualTo(
                secondChain
        );
    }

    @Test
    void canonicalEncodingSeparatesFieldBoundaries() {

        SecurityAuditLedgerHasher.AuditEvent first =
                new SecurityAuditLedgerHasher.AuditEvent(
                        UUID.fromString(
                                "00000000-0000-0000-0000-000000000003"
                        ),
                        "ab",
                        "c",
                        "",
                        "",
                        "SUCCESS",
                        "",
                        Instant.parse(
                                "2026-09-18T18:00:00Z"
                        )
                );

        SecurityAuditLedgerHasher.AuditEvent second =
                new SecurityAuditLedgerHasher.AuditEvent(
                        UUID.fromString(
                                "00000000-0000-0000-0000-000000000003"
                        ),
                        "a",
                        "bc",
                        "",
                        "",
                        "SUCCESS",
                        "",
                        Instant.parse(
                                "2026-09-18T18:00:00Z"
                        )
                );

        assertThat(
                hasher.eventHash(
                        first
                )
        ).isNotEqualTo(
                hasher.eventHash(
                        second
                )
        );
    }

    private SecurityAuditLedgerHasher.AuditEvent
    event(
            String id,
            String action,
            String outcome,
            String detail
    ) {
        return new SecurityAuditLedgerHasher.AuditEvent(
                UUID.fromString(
                        id
                ),
                "admin@fincrime.local",
                action,
                "SECURITY",
                "TEST",
                outcome,
                detail,
                Instant.parse(
                        "2026-09-18T18:00:00Z"
                )
        );
    }
}
