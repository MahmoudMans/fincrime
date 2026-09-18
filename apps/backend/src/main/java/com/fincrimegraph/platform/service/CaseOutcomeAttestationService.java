package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class CaseOutcomeAttestationService {

    private final JdbcTemplate jdbcTemplate;
    private final CaseOutcomeProvenanceHasher hasher;

    public CaseOutcomeAttestationService(
            JdbcTemplate jdbcTemplate,
            CaseOutcomeProvenanceHasher hasher
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.hasher =
                hasher;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public AttestationView attest(
            UUID caseId,
            String attestedBy
    ) {
        if (
                caseId == null
        ) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        String actor =
                requireText(
                        attestedBy,
                        "attestedBy",
                        180
                );

        CaseOutcomeProvenanceHasher.ProvenanceSnapshot
                snapshot =
                loadCurrentOutcome(
                        caseId
                );

        Integer existing =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM case_outcome_attestations
                        WHERE execution_id = ?
                        """,
                        Integer.class,
                        snapshot.executionId()
                );

        if (
                existing != null
                        && existing > 0
        ) {
            throw new IllegalArgumentException(
                    "The governed outcome execution already has an integrity attestation."
            );
        }

        String auditRoot =
                latestAuditRoot();

        String provenanceHash =
                hasher.hash(
                        snapshot
                );

        UUID attestationId =
                UUID.randomUUID();

        Instant attestedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO case_outcome_attestations (
                    id,
                    case_id,
                    execution_id,
                    proposal_id,
                    decision_version,
                    governed_outcome,
                    provenance_hash,
                    audit_root_hash,
                    attested_by,
                    attested_at
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
                    ?
                )
                """,
                attestationId,
                snapshot.caseId(),
                snapshot.executionId(),
                snapshot.proposalId(),
                snapshot.decisionVersion(),
                snapshot.governedOutcome(),
                provenanceHash,
                auditRoot,
                actor,
                Timestamp.from(
                        attestedAt
                )
        );

        return findAttestation(
                attestationId
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public VerificationView verify(
            UUID attestationId,
            String verifiedBy
    ) {
        if (
                attestationId == null
        ) {
            throw new IllegalArgumentException(
                    "attestationId is required."
            );
        }

        String actor =
                requireText(
                        verifiedBy,
                        "verifiedBy",
                        180
                );

        StoredAttestation stored =
                loadStoredAttestation(
                        attestationId
                );

        CaseOutcomeProvenanceHasher.ProvenanceSnapshot
                current =
                loadExecution(
                        stored.executionId()
                );

        String currentHash =
                hasher.hash(
                        current
                );

        boolean provenanceValid =
                stored.provenanceHash()
                        .equals(
                                currentHash
                        );

        Integer auditAnchorCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM security_audit_ledger_entries
                        WHERE chain_hash = ?
                        """,
                        Integer.class,
                        stored.auditRootHash()
                );

        boolean auditAnchorPresent =
                auditAnchorCount != null
                        && auditAnchorCount > 0;

        boolean integrityValid =
                provenanceValid
                        && auditAnchorPresent;

        String detail =
                integrityValid
                        ? "Outcome provenance and security-ledger anchor verified."
                        : "Outcome integrity verification detected a provenance or ledger-anchor mismatch.";

        UUID verificationId =
                UUID.randomUUID();

        Instant verifiedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO case_outcome_attestation_verifications (
                    id,
                    attestation_id,
                    provenance_valid,
                    audit_anchor_present,
                    integrity_valid,
                    detail,
                    verified_by,
                    verified_at
                )
                VALUES (
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
                verificationId,
                attestationId,
                provenanceValid,
                auditAnchorPresent,
                integrityValid,
                detail,
                actor,
                Timestamp.from(
                        verifiedAt
                )
        );

        return new VerificationView(
                verificationId.toString(),
                attestationId.toString(),
                provenanceValid,
                auditAnchorPresent,
                integrityValid,
                detail,
                actor,
                verifiedAt
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<AttestationView> attestations() {
        return jdbcTemplate.query(
                """
                SELECT a.id,
                       a.case_id,
                       c.case_number,
                       a.execution_id,
                       a.proposal_id,
                       a.decision_version,
                       a.governed_outcome,
                       a.provenance_hash,
                       a.audit_root_hash,
                       a.attested_by,
                       a.attested_at
                FROM case_outcome_attestations a
                JOIN investigation_cases c
                  ON c.id = a.case_id
                ORDER BY
                    a.attested_at DESC,
                    a.id
                """,
                this::mapAttestation
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<VerificationView> verifications() {
        return jdbcTemplate.query(
                """
                SELECT id,
                       attestation_id,
                       provenance_valid,
                       audit_anchor_present,
                       integrity_valid,
                       detail,
                       verified_by,
                       verified_at
                FROM case_outcome_attestation_verifications
                ORDER BY
                    verified_at DESC,
                    id
                LIMIT 50
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new VerificationView(
                                resultSet
                                        .getObject(
                                                "id",
                                                UUID.class
                                        )
                                        .toString(),
                                resultSet
                                        .getObject(
                                                "attestation_id",
                                                UUID.class
                                        )
                                        .toString(),
                                resultSet
                                        .getBoolean(
                                                "provenance_valid"
                                        ),
                                resultSet
                                        .getBoolean(
                                                "audit_anchor_present"
                                        ),
                                resultSet
                                        .getBoolean(
                                                "integrity_valid"
                                        ),
                                resultSet
                                        .getString(
                                                "detail"
                                        ),
                                resultSet
                                        .getString(
                                                "verified_by"
                                        ),
                                resultSet
                                        .getTimestamp(
                                                "verified_at"
                                        )
                                        .toInstant()
                        )
        );
    }

    private CaseOutcomeProvenanceHasher.ProvenanceSnapshot
    loadCurrentOutcome(
            UUID caseId
    ) {
        List<
                CaseOutcomeProvenanceHasher.ProvenanceSnapshot
                > values =
                jdbcTemplate.query(
                        """
                        SELECT e.case_id,
                               e.id AS execution_id,
                               e.proposal_id,
                               e.decision_version,
                               e.source_recommendation,
                               e.governed_outcome,
                               e.source_proposed_by,
                               e.source_reviewed_by,
                               e.execution_note,
                               e.executed_by,
                               e.executed_at
                        FROM governed_case_outcomes o
                        JOIN case_decision_executions e
                          ON e.id = o.execution_id
                        WHERE o.case_id = ?
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) ->
                                mapSnapshot(
                                        resultSet
                                ),
                        caseId
                );

        if (
                values.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "No governed outcome exists for case: "
                            + caseId
            );
        }

        return values.getFirst();
    }

    private CaseOutcomeProvenanceHasher.ProvenanceSnapshot
    loadExecution(
            UUID executionId
    ) {
        List<
                CaseOutcomeProvenanceHasher.ProvenanceSnapshot
                > values =
                jdbcTemplate.query(
                        """
                        SELECT case_id,
                               id AS execution_id,
                               proposal_id,
                               decision_version,
                               source_recommendation,
                               governed_outcome,
                               source_proposed_by,
                               source_reviewed_by,
                               execution_note,
                               executed_by,
                               executed_at
                        FROM case_decision_executions
                        WHERE id = ?
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) ->
                                mapSnapshot(
                                        resultSet
                                ),
                        executionId
                );

        if (
                values.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Decision execution not found: "
                            + executionId
            );
        }

        return values.getFirst();
    }

    private CaseOutcomeProvenanceHasher.ProvenanceSnapshot
    mapSnapshot(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new CaseOutcomeProvenanceHasher.ProvenanceSnapshot(
                resultSet
                        .getObject(
                                "case_id",
                                UUID.class
                        ),
                resultSet
                        .getObject(
                                "execution_id",
                                UUID.class
                        ),
                resultSet
                        .getObject(
                                "proposal_id",
                                UUID.class
                        ),
                resultSet
                        .getInt(
                                "decision_version"
                        ),
                resultSet
                        .getString(
                                "source_recommendation"
                        ),
                resultSet
                        .getString(
                                "governed_outcome"
                        ),
                resultSet
                        .getString(
                                "source_proposed_by"
                        ),
                resultSet
                        .getString(
                                "source_reviewed_by"
                        ),
                resultSet
                        .getString(
                                "execution_note"
                        ),
                resultSet
                        .getString(
                                "executed_by"
                        ),
                resultSet
                        .getTimestamp(
                                "executed_at"
                        )
                        .toInstant()
        );
    }

    private String latestAuditRoot() {
        String value =
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
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Security audit ledger does not yet contain an anchor root."
            );
        }

        return value;
    }

    private StoredAttestation loadStoredAttestation(
            UUID attestationId
    ) {
        StoredAttestation value =
                jdbcTemplate.query(
                        """
                        SELECT id,
                               execution_id,
                               provenance_hash,
                               audit_root_hash
                        FROM case_outcome_attestations
                        WHERE id = ?
                        """,
                        resultSet -> {
                            if (
                                    !resultSet.next()
                            ) {
                                return null;
                            }

                            return new StoredAttestation(
                                    resultSet
                                            .getObject(
                                                    "id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getObject(
                                                    "execution_id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getString(
                                                    "provenance_hash"
                                            ),
                                    resultSet
                                            .getString(
                                                    "audit_root_hash"
                                            )
                            );
                        },
                        attestationId
                );

        if (
                value == null
        ) {
            throw new IllegalArgumentException(
                    "Outcome attestation not found: "
                            + attestationId
            );
        }

        return value;
    }

    private AttestationView findAttestation(
            UUID attestationId
    ) {
        List<AttestationView> values =
                jdbcTemplate.query(
                        """
                        SELECT a.id,
                               a.case_id,
                               c.case_number,
                               a.execution_id,
                               a.proposal_id,
                               a.decision_version,
                               a.governed_outcome,
                               a.provenance_hash,
                               a.audit_root_hash,
                               a.attested_by,
                               a.attested_at
                        FROM case_outcome_attestations a
                        JOIN investigation_cases c
                          ON c.id = a.case_id
                        WHERE a.id = ?
                        """,
                        this::mapAttestation,
                        attestationId
                );

        if (
                values.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Outcome attestation not found: "
                            + attestationId
            );
        }

        return values.getFirst();
    }

    private AttestationView mapAttestation(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {
        return new AttestationView(
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
                        .getObject(
                                "execution_id",
                                UUID.class
                        )
                        .toString(),
                resultSet
                        .getObject(
                                "proposal_id",
                                UUID.class
                        )
                        .toString(),
                resultSet
                        .getInt(
                                "decision_version"
                        ),
                resultSet
                        .getString(
                                "governed_outcome"
                        ),
                resultSet
                        .getString(
                                "provenance_hash"
                        ),
                resultSet
                        .getString(
                                "audit_root_hash"
                        ),
                resultSet
                        .getString(
                                "attested_by"
                        ),
                resultSet
                        .getTimestamp(
                                "attested_at"
                        )
                        .toInstant()
        );
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

    private record StoredAttestation(
            UUID id,
            UUID executionId,
            String provenanceHash,
            String auditRootHash
    ) {
    }

    public record AttestationView(
            String id,
            String caseId,
            String caseNumber,
            String executionId,
            String proposalId,
            int decisionVersion,
            String governedOutcome,
            String provenanceHash,
            String auditRootHash,
            String attestedBy,
            Instant attestedAt
    ) {
    }

    public record VerificationView(
            String id,
            String attestationId,
            boolean provenanceValid,
            boolean auditAnchorPresent,
            boolean integrityValid,
            String detail,
            String verifiedBy,
            Instant verifiedAt
    ) {
    }
}
