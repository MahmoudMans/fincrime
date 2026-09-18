package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class SecurityAuditLedgerService {

    private final JdbcTemplate jdbcTemplate;
    private final SecurityAuditLedgerHasher hasher;

    public SecurityAuditLedgerService(
            JdbcTemplate jdbcTemplate,
            SecurityAuditLedgerHasher hasher
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.hasher =
                hasher;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public LedgerStatusView status() {
        VerificationState state =
                verifyInternal();

        return toStatusView(
                state
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public LedgerRefreshView refreshAndVerify() {

        VerificationState before =
                verifyInternal();

        if (
                !before.chainValid()
        ) {
            persistVerification(
                    before,
                    0,
                    "Existing ledger chain failed integrity validation; "
                            + "no new entries were appended."
            );

            return new LedgerRefreshView(
                    0,
                    toStatusView(
                            before
                    )
            );
        }

        Set<UUID> chainedIds =
                new HashSet<>(
                        jdbcTemplate.query(
                                """
                                SELECT audit_event_id
                                FROM security_audit_ledger_entries
                                """,
                                (
                                        resultSet,
                                        rowNumber
                                ) ->
                                        resultSet.getObject(
                                                "audit_event_id",
                                                UUID.class
                                        )
                        )
                );

        String previousHash =
                jdbcTemplate.query(
                                """
                                SELECT chain_hash
                                FROM security_audit_ledger_entries
                                ORDER BY sequence_number DESC
                                LIMIT 1
                                """,
                                resultSet ->
                                        resultSet.next()
                                                ? resultSet.getString(
                                                "chain_hash"
                                        )
                                                : null
                        );

        if (
                previousHash == null
                        || previousHash
                        .isBlank()
        ) {
            previousHash =
                    SecurityAuditLedgerHasher
                            .GENESIS_HASH;
        }

        List<
                SecurityAuditLedgerHasher.AuditEvent
                > sourceEvents =
                loadSourceEvents();

        int appended =
                0;

        Instant chainedAt =
                Instant.now();

        for (
                SecurityAuditLedgerHasher.AuditEvent event
                        : sourceEvents
        ) {
            if (
                    chainedIds.contains(
                            event.id()
                    )
            ) {
                continue;
            }

            String eventHash =
                    hasher.eventHash(
                            event
                    );

            String chainHash =
                    hasher.chainHash(
                            previousHash,
                            eventHash
                    );

            jdbcTemplate.update(
                    """
                    INSERT INTO security_audit_ledger_entries (
                        audit_event_id,
                        event_hash,
                        previous_chain_hash,
                        chain_hash,
                        event_occurred_at,
                        chained_at
                    )
                    VALUES (
                        ?,
                        ?,
                        ?,
                        ?,
                        ?,
                        ?
                    )
                    """,
                    event.id(),
                    eventHash,
                    previousHash,
                    chainHash,
                    Timestamp.from(
                            event.occurredAt()
                    ),
                    Timestamp.from(
                            chainedAt
                    )
            );

            previousHash =
                    chainHash;

            chainedIds.add(
                    event.id()
            );

            appended++;
        }

        VerificationState after =
                verifyInternal();

        String detail =
                after.integrityValid()
                        ? "Audit ledger is complete and cryptographically consistent."
                        : "Audit ledger verification found integrity or coverage issues.";

        persistVerification(
                after,
                appended,
                detail
        );

        return new LedgerRefreshView(
                appended,
                toStatusView(
                        after
                )
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<VerificationHistoryView>
    verificationHistory() {

        return jdbcTemplate.query(
                """
                SELECT id,
                       verified_at,
                       source_event_count,
                       ledger_entry_count,
                       uncovered_event_count,
                       appended_count,
                       chain_valid,
                       complete,
                       integrity_valid,
                       root_hash,
                       detail
                FROM security_audit_ledger_verifications
                ORDER BY verified_at DESC
                LIMIT 12
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new VerificationHistoryView(
                                resultSet
                                        .getObject(
                                                "id",
                                                UUID.class
                                        )
                                        .toString(),
                                resultSet
                                        .getTimestamp(
                                                "verified_at"
                                        )
                                        .toInstant(),
                                resultSet
                                        .getLong(
                                                "source_event_count"
                                        ),
                                resultSet
                                        .getLong(
                                                "ledger_entry_count"
                                        ),
                                resultSet
                                        .getLong(
                                                "uncovered_event_count"
                                        ),
                                resultSet
                                        .getLong(
                                                "appended_count"
                                        ),
                                resultSet
                                        .getBoolean(
                                                "chain_valid"
                                        ),
                                resultSet
                                        .getBoolean(
                                                "complete"
                                        ),
                                resultSet
                                        .getBoolean(
                                                "integrity_valid"
                                        ),
                                resultSet
                                        .getString(
                                                "root_hash"
                                        ),
                                resultSet
                                        .getString(
                                                "detail"
                                        )
                        )
        );
    }

    private VerificationState verifyInternal() {

        long sourceEventCount =
                count(
                        """
                        SELECT COUNT(*)
                        FROM security_audit_events
                        """
                );

        List<LedgerSourceRow> ledgerRows =
                jdbcTemplate.query(
                        """
                        SELECT l.sequence_number,
                               l.audit_event_id,
                               l.event_hash,
                               l.previous_chain_hash,
                               l.chain_hash,
                               e.username,
                               e.action,
                               COALESCE(
                                   e.resource_type,
                                   ''
                               ) AS resource_type,
                               COALESCE(
                                   e.resource_id,
                                   ''
                               ) AS resource_id,
                               e.outcome,
                               COALESCE(
                                   e.detail,
                                   ''
                               ) AS detail,
                               e.occurred_at
                        FROM security_audit_ledger_entries l
                        LEFT JOIN security_audit_events e
                          ON e.id = l.audit_event_id
                        ORDER BY l.sequence_number
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) -> {
                            Timestamp occurredAt =
                                    resultSet
                                            .getTimestamp(
                                                    "occurred_at"
                                            );

                            SecurityAuditLedgerHasher.AuditEvent
                                    event =
                                    occurredAt == null
                                            ? null
                                            : new SecurityAuditLedgerHasher.AuditEvent(
                                            resultSet
                                                    .getObject(
                                                            "audit_event_id",
                                                            UUID.class
                                                    ),
                                            resultSet
                                                    .getString(
                                                            "username"
                                                    ),
                                            resultSet
                                                    .getString(
                                                            "action"
                                                    ),
                                            resultSet
                                                    .getString(
                                                            "resource_type"
                                                    ),
                                            resultSet
                                                    .getString(
                                                            "resource_id"
                                                    ),
                                            resultSet
                                                    .getString(
                                                            "outcome"
                                                    ),
                                            resultSet
                                                    .getString(
                                                            "detail"
                                                    ),
                                            occurredAt
                                                    .toInstant()
                                    );

                            return new LedgerSourceRow(
                                    resultSet
                                            .getLong(
                                                    "sequence_number"
                                            ),
                                    resultSet
                                            .getObject(
                                                    "audit_event_id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getString(
                                                    "event_hash"
                                            ),
                                    resultSet
                                            .getString(
                                                    "previous_chain_hash"
                                            ),
                                    resultSet
                                            .getString(
                                                    "chain_hash"
                                            ),
                                    event
                            );
                        }
                );

        boolean chainValid =
                true;

        String expectedPrevious =
                SecurityAuditLedgerHasher
                        .GENESIS_HASH;

        String rootHash =
                SecurityAuditLedgerHasher
                        .GENESIS_HASH;

        long expectedSequence =
                1L;

        for (
                LedgerSourceRow row
                        : ledgerRows
        ) {
            if (
                    row.sequenceNumber()
                            != expectedSequence
            ) {
                chainValid =
                        false;
            }

            if (
                    row.sourceEvent()
                            == null
            ) {
                chainValid =
                        false;

                expectedPrevious =
                        row.chainHash();

                rootHash =
                        row.chainHash();

                expectedSequence++;

                continue;
            }

            String expectedEventHash =
                    hasher.eventHash(
                            row.sourceEvent()
                    );

            if (
                    !expectedEventHash
                            .equals(
                                    row.eventHash()
                            )
            ) {
                chainValid =
                        false;
            }

            if (
                    !expectedPrevious
                            .equals(
                                    row.previousChainHash()
                            )
            ) {
                chainValid =
                        false;
            }

            String expectedChainHash =
                    hasher.chainHash(
                            expectedPrevious,
                            expectedEventHash
                    );

            if (
                    !expectedChainHash
                            .equals(
                                    row.chainHash()
                            )
            ) {
                chainValid =
                        false;
            }

            expectedPrevious =
                    row.chainHash();

            rootHash =
                    row.chainHash();

            expectedSequence++;
        }

        long ledgerEntryCount =
                ledgerRows.size();

        long uncoveredEventCount =
                count(
                        """
                        SELECT COUNT(*)
                        FROM security_audit_events e
                        WHERE NOT EXISTS (
                            SELECT 1
                            FROM security_audit_ledger_entries l
                            WHERE l.audit_event_id = e.id
                        )
                        """
                );

        boolean complete =
                sourceEventCount
                        == ledgerEntryCount
                        && uncoveredEventCount
                        == 0;

        boolean integrityValid =
                chainValid
                        && complete;

        return new VerificationState(
                sourceEventCount,
                ledgerEntryCount,
                uncoveredEventCount,
                chainValid,
                complete,
                integrityValid,
                rootHash,
                Instant.now()
        );
    }

    private List<
            SecurityAuditLedgerHasher.AuditEvent
            > loadSourceEvents() {

        return jdbcTemplate.query(
                """
                SELECT id,
                       username,
                       action,
                       COALESCE(
                           resource_type,
                           ''
                       ) AS resource_type,
                       COALESCE(
                           resource_id,
                           ''
                       ) AS resource_id,
                       outcome,
                       COALESCE(
                           detail,
                           ''
                       ) AS detail,
                       occurred_at
                FROM security_audit_events
                ORDER BY
                    occurred_at,
                    id
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SecurityAuditLedgerHasher.AuditEvent(
                                resultSet
                                        .getObject(
                                                "id",
                                                UUID.class
                                        ),
                                resultSet
                                        .getString(
                                                "username"
                                        ),
                                resultSet
                                        .getString(
                                                "action"
                                        ),
                                resultSet
                                        .getString(
                                                "resource_type"
                                        ),
                                resultSet
                                        .getString(
                                                "resource_id"
                                        ),
                                resultSet
                                        .getString(
                                                "outcome"
                                        ),
                                resultSet
                                        .getString(
                                                "detail"
                                        ),
                                resultSet
                                        .getTimestamp(
                                                "occurred_at"
                                        )
                                        .toInstant()
                        )
        );
    }

    private void persistVerification(
            VerificationState state,
            long appendedCount,
            String detail
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO security_audit_ledger_verifications (
                    id,
                    verified_at,
                    source_event_count,
                    ledger_entry_count,
                    uncovered_event_count,
                    appended_count,
                    chain_valid,
                    complete,
                    integrity_valid,
                    root_hash,
                    detail
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                """,
                UUID.randomUUID(),
                Timestamp.from(
                        state.verifiedAt()
                ),
                state.sourceEventCount(),
                state.ledgerEntryCount(),
                state.uncoveredEventCount(),
                appendedCount,
                state.chainValid(),
                state.complete(),
                state.integrityValid(),
                state.rootHash(),
                detail
        );
    }

    private long count(
            String sql
    ) {
        Long value =
                jdbcTemplate
                        .queryForObject(
                                sql,
                                Long.class
                        );

        return value == null
                ? 0L
                : value;
    }

    private LedgerStatusView toStatusView(
            VerificationState state
    ) {
        return new LedgerStatusView(
                state.sourceEventCount(),
                state.ledgerEntryCount(),
                state.uncoveredEventCount(),
                state.chainValid(),
                state.complete(),
                state.integrityValid(),
                state.rootHash(),
                state.verifiedAt()
        );
    }

    private record LedgerSourceRow(
            long sequenceNumber,
            UUID auditEventId,
            String eventHash,
            String previousChainHash,
            String chainHash,
            SecurityAuditLedgerHasher.AuditEvent sourceEvent
    ) {
    }

    private record VerificationState(
            long sourceEventCount,
            long ledgerEntryCount,
            long uncoveredEventCount,
            boolean chainValid,
            boolean complete,
            boolean integrityValid,
            String rootHash,
            Instant verifiedAt
    ) {
    }

    public record LedgerStatusView(
            long sourceEventCount,
            long ledgerEntryCount,
            long uncoveredEventCount,
            boolean chainValid,
            boolean complete,
            boolean integrityValid,
            String rootHash,
            Instant verifiedAt
    ) {
    }

    public record LedgerRefreshView(
            long appendedCount,
            LedgerStatusView status
    ) {
    }

    public record VerificationHistoryView(
            String id,
            Instant verifiedAt,
            long sourceEventCount,
            long ledgerEntryCount,
            long uncoveredEventCount,
            long appendedCount,
            boolean chainValid,
            boolean complete,
            boolean integrityValid,
            String rootHash,
            String detail
    ) {
    }
}
