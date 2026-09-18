package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class EvidenceChainOfCustodyService {

    private static final Pattern SHA_256 =
            Pattern.compile(
                    "^[0-9a-f]{64}$"
            );

    private final JdbcTemplate jdbcTemplate;
    private final EvidenceIntegrityHasher hasher;

    public EvidenceChainOfCustodyService(
            JdbcTemplate jdbcTemplate,
            EvidenceIntegrityHasher hasher
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.hasher =
                hasher;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public EvidenceView register(
            UUID caseId,
            String evidenceReference,
            String evidenceType,
            String title,
            String sourceReference,
            String description,
            String contentSha256,
            String registeredBy
    ) {
        if (
                caseId == null
        ) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        ensureCaseExists(
                caseId
        );

        String normalizedReference =
                requireText(
                        evidenceReference,
                        "evidenceReference",
                        160
                );

        String normalizedType =
                requireText(
                        evidenceType,
                        "evidenceType",
                        80
                )
                        .toUpperCase(
                                Locale.ROOT
                        );

        String normalizedTitle =
                requireText(
                        title,
                        "title",
                        240
                );

        String normalizedSource =
                requireText(
                        sourceReference,
                        "sourceReference",
                        600
                );

        String normalizedDescription =
                requireText(
                        description,
                        "description",
                        2000
                );

        String normalizedContentHash =
                normalizeSha256(
                        contentSha256
                );

        String actor =
                requireText(
                        registeredBy,
                        "registeredBy",
                        180
                );

        Integer duplicateCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_evidence_registry
                        WHERE case_id = ?
                          AND LOWER(evidence_reference)
                              = LOWER(?)
                        """,
                        Integer.class,
                        caseId,
                        normalizedReference
                );

        if (
                duplicateCount != null
                        && duplicateCount > 0
        ) {
            throw new IllegalArgumentException(
                    "The case already contains evidence reference "
                            + normalizedReference
                            + "."
            );
        }

        EvidenceIntegrityHasher.EvidenceSnapshot
                snapshot =
                new EvidenceIntegrityHasher.EvidenceSnapshot(
                        caseId,
                        normalizedReference,
                        normalizedType,
                        normalizedTitle,
                        normalizedSource,
                        normalizedDescription,
                        normalizedContentHash
                );

        String registryFingerprint =
                hasher.registryFingerprint(
                        snapshot
                );

        UUID evidenceId =
                UUID.randomUUID();

        Instant registeredAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO investigation_evidence_registry (
                    id,
                    case_id,
                    evidence_reference,
                    evidence_type,
                    title,
                    source_reference,
                    description,
                    content_sha256,
                    registry_fingerprint,
                    current_custodian,
                    current_status,
                    registered_by,
                    registered_at
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
                    'REGISTERED',
                    ?,
                    ?
                )
                """,
                evidenceId,
                caseId,
                normalizedReference,
                normalizedType,
                normalizedTitle,
                normalizedSource,
                normalizedDescription,
                normalizedContentHash,
                registryFingerprint,
                actor,
                actor,
                Timestamp.from(
                        registeredAt
                )
        );

        appendEvent(
                evidenceId,
                "REGISTERED",
                null,
                actor,
                actor,
                "Evidence registered into the investigation custody registry.",
                registryFingerprint,
                registeredAt
        );

        return findEvidence(
                evidenceId
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public EvidenceView transfer(
            UUID evidenceId,
            String toCustodian,
            String transferNote,
            String actorUsername
    ) {
        EvidenceState evidence =
                loadEvidenceState(
                        evidenceId
                );

        String destination =
                requireText(
                        toCustodian,
                        "toCustodian",
                        180
                );

        String note =
                requireText(
                        transferNote,
                        "transferNote",
                        2000
                );

        String actor =
                requireText(
                        actorUsername,
                        "actorUsername",
                        180
                );

        if (
                evidence.currentCustodian()
                        .equalsIgnoreCase(
                                destination
                        )
        ) {
            throw new IllegalArgumentException(
                    "Evidence is already held by the requested custodian."
            );
        }

        Instant occurredAt =
                Instant.now();

        appendEvent(
                evidence.id(),
                "TRANSFERRED",
                evidence.currentCustodian(),
                destination,
                actor,
                note,
                evidence.registryFingerprint(),
                occurredAt
        );

        jdbcTemplate.update(
                """
                UPDATE investigation_evidence_registry
                SET current_custodian = ?,
                    current_status = 'TRANSFERRED'
                WHERE id = ?
                """,
                destination,
                evidence.id()
        );

        return findEvidence(
                evidence.id()
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public IntegrityVerificationView verify(
            UUID evidenceId,
            String actorUsername
    ) {
        EvidenceState before =
                loadEvidenceState(
                        evidenceId
                );

        String actor =
                requireText(
                        actorUsername,
                        "actorUsername",
                        180
                );

        IntegrityState integrity =
                validateIntegrity(
                        before
                );

        String note =
                integrity.integrityValid()
                        ? "Evidence metadata fingerprint and custody chain verified."
                        : "Evidence integrity verification detected a metadata fingerprint or custody-chain mismatch.";

        Instant occurredAt =
                Instant.now();

        appendEvent(
                before.id(),
                "VERIFIED",
                before.currentCustodian(),
                before.currentCustodian(),
                actor,
                note,
                before.registryFingerprint(),
                occurredAt
        );

        jdbcTemplate.update(
                """
                UPDATE investigation_evidence_registry
                SET current_status = ?
                WHERE id = ?
                """,
                integrity.integrityValid()
                        ? "VERIFIED"
                        : "INTEGRITY_ALERT",
                before.id()
        );

        EvidenceState after =
                loadEvidenceState(
                        before.id()
                );

        IntegrityState finalState =
                validateIntegrity(
                        after
                );

        return new IntegrityVerificationView(
                before.id()
                        .toString(),
                finalState.registryFingerprintValid(),
                finalState.custodyChainValid(),
                finalState.integrityValid(),
                finalState.eventCount(),
                after.currentCustodian(),
                after.currentStatus(),
                note,
                actor,
                occurredAt
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<EvidenceView> registry() {
        return jdbcTemplate.query(
                """
                SELECT e.id,
                       e.case_id,
                       c.case_number,
                       e.evidence_reference,
                       e.evidence_type,
                       e.title,
                       e.source_reference,
                       e.description,
                       e.content_sha256,
                       e.registry_fingerprint,
                       e.current_custodian,
                       e.current_status,
                       e.registered_by,
                       e.registered_at,
                       (
                           SELECT COUNT(*)
                           FROM investigation_evidence_custody_events ce
                           WHERE ce.evidence_id = e.id
                       ) AS custody_event_count
                FROM investigation_evidence_registry e
                JOIN investigation_cases c
                  ON c.id = e.case_id
                ORDER BY
                    e.registered_at DESC,
                    e.evidence_reference
                """,
                this::mapEvidence
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<CustodyEventView> events(
            UUID evidenceId
    ) {
        loadEvidenceState(
                evidenceId
        );

        return jdbcTemplate.query(
                """
                SELECT id,
                       evidence_id,
                       sequence_number,
                       event_type,
                       from_custodian,
                       to_custodian,
                       actor_username,
                       event_note,
                       previous_event_hash,
                       event_hash,
                       occurred_at
                FROM investigation_evidence_custody_events
                WHERE evidence_id = ?
                ORDER BY sequence_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CustodyEventView(
                                resultSet
                                        .getObject(
                                                "id",
                                                UUID.class
                                        )
                                        .toString(),
                                resultSet
                                        .getObject(
                                                "evidence_id",
                                                UUID.class
                                        )
                                        .toString(),
                                resultSet
                                        .getInt(
                                                "sequence_number"
                                        ),
                                resultSet
                                        .getString(
                                                "event_type"
                                        ),
                                resultSet
                                        .getString(
                                                "from_custodian"
                                        ),
                                resultSet
                                        .getString(
                                                "to_custodian"
                                        ),
                                resultSet
                                        .getString(
                                                "actor_username"
                                        ),
                                resultSet
                                        .getString(
                                                "event_note"
                                        ),
                                resultSet
                                        .getString(
                                                "previous_event_hash"
                                        ),
                                resultSet
                                        .getString(
                                                "event_hash"
                                        ),
                                resultSet
                                        .getTimestamp(
                                                "occurred_at"
                                        )
                                        .toInstant()
                        ),
                evidenceId
        );
    }

    private IntegrityState validateIntegrity(
            EvidenceState evidence
    ) {
        EvidenceIntegrityHasher.EvidenceSnapshot
                snapshot =
                new EvidenceIntegrityHasher.EvidenceSnapshot(
                        evidence.caseId(),
                        evidence.evidenceReference(),
                        evidence.evidenceType(),
                        evidence.title(),
                        evidence.sourceReference(),
                        evidence.description(),
                        evidence.contentSha256()
                );

        String recomputedFingerprint =
                hasher.registryFingerprint(
                        snapshot
                );

        boolean fingerprintValid =
                evidence.registryFingerprint()
                        .equals(
                                recomputedFingerprint
                        );

        List<CustodyEventState> events =
                loadEventStates(
                        evidence.id()
                );

        String expectedPrevious =
                EvidenceIntegrityHasher
                        .GENESIS_HASH;

        int expectedSequence =
                1;

        boolean chainValid =
                true;

        for (
                CustodyEventState event
                        : events
        ) {
            if (
                    event.sequenceNumber()
                            != expectedSequence
            ) {
                chainValid =
                        false;
            }

            if (
                    !expectedPrevious.equals(
                            event.previousEventHash()
                    )
            ) {
                chainValid =
                        false;
            }

            String expectedHash =
                    hasher.custodyEventHash(
                            expectedPrevious,
                            new EvidenceIntegrityHasher.CustodyEventSnapshot(
                                    evidence.id(),
                                    event.sequenceNumber(),
                                    event.eventType(),
                                    event.fromCustodian(),
                                    event.toCustodian(),
                                    event.actorUsername(),
                                    event.eventNote(),
                                    evidence.registryFingerprint(),
                                    event.occurredAt()
                            )
                    );

            if (
                    !expectedHash.equals(
                            event.eventHash()
                    )
            ) {
                chainValid =
                        false;
            }

            expectedPrevious =
                    event.eventHash();

            expectedSequence++;
        }

        return new IntegrityState(
                fingerprintValid,
                chainValid,
                fingerprintValid
                        && chainValid,
                events.size()
        );
    }

    private void appendEvent(
            UUID evidenceId,
            String eventType,
            String fromCustodian,
            String toCustodian,
            String actorUsername,
            String eventNote,
            String registryFingerprint,
            Instant occurredAt
    ) {
        Integer currentSequence =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            MAX(sequence_number),
                            0
                        )
                        FROM investigation_evidence_custody_events
                        WHERE evidence_id = ?
                        """,
                        Integer.class,
                        evidenceId
                );

        int nextSequence =
                (
                        currentSequence == null
                                ? 0
                                : currentSequence
                )
                        + 1;

        String previousHash =
                jdbcTemplate.query(
                        """
                        SELECT event_hash
                        FROM investigation_evidence_custody_events
                        WHERE evidence_id = ?
                        ORDER BY sequence_number DESC
                        LIMIT 1
                        """,
                        resultSet ->
                                resultSet.next()
                                        ? resultSet.getString(
                                        "event_hash"
                                )
                                        : EvidenceIntegrityHasher
                                        .GENESIS_HASH,
                        evidenceId
                );

        EvidenceIntegrityHasher.CustodyEventSnapshot
                event =
                new EvidenceIntegrityHasher.CustodyEventSnapshot(
                        evidenceId,
                        nextSequence,
                        eventType,
                        fromCustodian,
                        toCustodian,
                        actorUsername,
                        eventNote,
                        registryFingerprint,
                        occurredAt
                );

        String eventHash =
                hasher.custodyEventHash(
                        previousHash,
                        event
                );

        jdbcTemplate.update(
                """
                INSERT INTO investigation_evidence_custody_events (
                    id,
                    evidence_id,
                    sequence_number,
                    event_type,
                    from_custodian,
                    to_custodian,
                    actor_username,
                    event_note,
                    previous_event_hash,
                    event_hash,
                    occurred_at
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
                evidenceId,
                nextSequence,
                eventType,
                fromCustodian,
                toCustodian,
                actorUsername,
                eventNote,
                previousHash,
                eventHash,
                Timestamp.from(
                        occurredAt
                )
        );
    }

    private List<CustodyEventState> loadEventStates(
            UUID evidenceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT sequence_number,
                       event_type,
                       from_custodian,
                       to_custodian,
                       actor_username,
                       event_note,
                       previous_event_hash,
                       event_hash,
                       occurred_at
                FROM investigation_evidence_custody_events
                WHERE evidence_id = ?
                ORDER BY sequence_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CustodyEventState(
                                resultSet
                                        .getInt(
                                                "sequence_number"
                                        ),
                                resultSet
                                        .getString(
                                                "event_type"
                                        ),
                                resultSet
                                        .getString(
                                                "from_custodian"
                                        ),
                                resultSet
                                        .getString(
                                                "to_custodian"
                                        ),
                                resultSet
                                        .getString(
                                                "actor_username"
                                        ),
                                resultSet
                                        .getString(
                                                "event_note"
                                        ),
                                resultSet
                                        .getString(
                                                "previous_event_hash"
                                        ),
                                resultSet
                                        .getString(
                                                "event_hash"
                                        ),
                                resultSet
                                        .getTimestamp(
                                                "occurred_at"
                                        )
                                        .toInstant()
                        ),
                evidenceId
        );
    }

    private EvidenceView findEvidence(
            UUID evidenceId
    ) {
        List<EvidenceView> values =
                jdbcTemplate.query(
                        """
                        SELECT e.id,
                               e.case_id,
                               c.case_number,
                               e.evidence_reference,
                               e.evidence_type,
                               e.title,
                               e.source_reference,
                               e.description,
                               e.content_sha256,
                               e.registry_fingerprint,
                               e.current_custodian,
                               e.current_status,
                               e.registered_by,
                               e.registered_at,
                               (
                                   SELECT COUNT(*)
                                   FROM investigation_evidence_custody_events ce
                                   WHERE ce.evidence_id = e.id
                               ) AS custody_event_count
                        FROM investigation_evidence_registry e
                        JOIN investigation_cases c
                          ON c.id = e.case_id
                        WHERE e.id = ?
                        """,
                        this::mapEvidence,
                        evidenceId
                );

        if (
                values.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Evidence not found: "
                            + evidenceId
            );
        }

        return values.getFirst();
    }

    private EvidenceView mapEvidence(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {
        return new EvidenceView(
                resultSet
                        .getObject(
                                "id",
                                UUID.class
                        )
                        .toString(),
                resultSet
                        .getObject(
                                "case_id",
                                UUID.class
                        )
                        .toString(),
                resultSet
                        .getString(
                                "case_number"
                        ),
                resultSet
                        .getString(
                                "evidence_reference"
                        ),
                resultSet
                        .getString(
                                "evidence_type"
                        ),
                resultSet
                        .getString(
                                "title"
                        ),
                resultSet
                        .getString(
                                "source_reference"
                        ),
                resultSet
                        .getString(
                                "description"
                        ),
                resultSet
                        .getString(
                                "content_sha256"
                        ),
                resultSet
                        .getString(
                                "registry_fingerprint"
                        ),
                resultSet
                        .getString(
                                "current_custodian"
                        ),
                resultSet
                        .getString(
                                "current_status"
                        ),
                resultSet
                        .getString(
                                "registered_by"
                        ),
                resultSet
                        .getTimestamp(
                                "registered_at"
                        )
                        .toInstant(),
                resultSet
                        .getInt(
                                "custody_event_count"
                        )
        );
    }

    private EvidenceState loadEvidenceState(
            UUID evidenceId
    ) {
        if (
                evidenceId == null
        ) {
            throw new IllegalArgumentException(
                    "evidenceId is required."
            );
        }

        EvidenceState value =
                jdbcTemplate.query(
                        """
                        SELECT id,
                               case_id,
                               evidence_reference,
                               evidence_type,
                               title,
                               source_reference,
                               description,
                               content_sha256,
                               registry_fingerprint,
                               current_custodian,
                               current_status
                        FROM investigation_evidence_registry
                        WHERE id = ?
                        """,
                        resultSet -> {
                            if (
                                    !resultSet.next()
                            ) {
                                return null;
                            }

                            return new EvidenceState(
                                    resultSet
                                            .getObject(
                                                    "id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getObject(
                                                    "case_id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getString(
                                                    "evidence_reference"
                                            ),
                                    resultSet
                                            .getString(
                                                    "evidence_type"
                                            ),
                                    resultSet
                                            .getString(
                                                    "title"
                                            ),
                                    resultSet
                                            .getString(
                                                    "source_reference"
                                            ),
                                    resultSet
                                            .getString(
                                                    "description"
                                            ),
                                    resultSet
                                            .getString(
                                                    "content_sha256"
                                            ),
                                    resultSet
                                            .getString(
                                                    "registry_fingerprint"
                                            ),
                                    resultSet
                                            .getString(
                                                    "current_custodian"
                                            ),
                                    resultSet
                                            .getString(
                                                    "current_status"
                                            )
                            );
                        },
                        evidenceId
                );

        if (
                value == null
        ) {
            throw new IllegalArgumentException(
                    "Evidence not found: "
                            + evidenceId
            );
        }

        return value;
    }

    private void ensureCaseExists(
            UUID caseId
    ) {
        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_cases
                        WHERE id = ?
                        """,
                        Integer.class,
                        caseId
                );

        if (
                count == null
                        || count != 1
        ) {
            throw new IllegalArgumentException(
                    "Investigation case not found: "
                            + caseId
            );
        }
    }

    private String normalizeSha256(
            String value
    ) {
        String normalized =
                requireText(
                        value,
                        "contentSha256",
                        64
                )
                        .toLowerCase(
                                Locale.ROOT
                        );

        if (
                !SHA_256.matcher(
                        normalized
                )
                        .matches()
        ) {
            throw new IllegalArgumentException(
                    "contentSha256 must contain exactly 64 hexadecimal characters."
            );
        }

        return normalized;
    }

    private String requireText(
            String value,
            String field,
            int maxLength
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    field
                            + " is required."
            );
        }

        String normalized =
                value.trim();

        if (
                normalized.length()
                        > maxLength
        ) {
            throw new IllegalArgumentException(
                    field
                            + " exceeds "
                            + maxLength
                            + " characters."
            );
        }

        return normalized;
    }

    private record EvidenceState(
            UUID id,
            UUID caseId,
            String evidenceReference,
            String evidenceType,
            String title,
            String sourceReference,
            String description,
            String contentSha256,
            String registryFingerprint,
            String currentCustodian,
            String currentStatus
    ) {
    }

    private record CustodyEventState(
            int sequenceNumber,
            String eventType,
            String fromCustodian,
            String toCustodian,
            String actorUsername,
            String eventNote,
            String previousEventHash,
            String eventHash,
            Instant occurredAt
    ) {
    }

    private record IntegrityState(
            boolean registryFingerprintValid,
            boolean custodyChainValid,
            boolean integrityValid,
            int eventCount
    ) {
    }

    public record EvidenceView(
            String id,
            String caseId,
            String caseNumber,
            String evidenceReference,
            String evidenceType,
            String title,
            String sourceReference,
            String description,
            String contentSha256,
            String registryFingerprint,
            String currentCustodian,
            String currentStatus,
            String registeredBy,
            Instant registeredAt,
            int custodyEventCount
    ) {
    }

    public record CustodyEventView(
            String id,
            String evidenceId,
            int sequenceNumber,
            String eventType,
            String fromCustodian,
            String toCustodian,
            String actorUsername,
            String eventNote,
            String previousEventHash,
            String eventHash,
            Instant occurredAt
    ) {
    }

    public record IntegrityVerificationView(
            String evidenceId,
            boolean registryFingerprintValid,
            boolean custodyChainValid,
            boolean integrityValid,
            int eventCount,
            String currentCustodian,
            String currentStatus,
            String detail,
            String verifiedBy,
            Instant verifiedAt
    ) {
    }
}
