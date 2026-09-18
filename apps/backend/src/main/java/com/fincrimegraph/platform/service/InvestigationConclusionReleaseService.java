package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class InvestigationConclusionReleaseService {

    private final JdbcTemplate jdbcTemplate;
    private final InvestigationConclusionReleasePolicy policy;
    private final ConclusionReleaseFingerprint fingerprint;

    public InvestigationConclusionReleaseService(
            JdbcTemplate jdbcTemplate,
            InvestigationConclusionReleasePolicy policy,
            ConclusionReleaseFingerprint fingerprint
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.policy =
                policy;

        this.fingerprint =
                fingerprint;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public PackageView prepare(
            UUID findingId,
            String conclusionSummary,
            String releaseRationale,
            String preparedBy
    ) {
        if (
                findingId == null
        ) {
            throw new IllegalArgumentException(
                    "findingId is required."
            );
        }

        String summary =
                requireText(
                        conclusionSummary,
                        "conclusionSummary",
                        4000
                );

        String rationale =
                requireText(
                        releaseRationale,
                        "releaseRationale",
                        2000
                );

        String actor =
                requireText(
                        preparedBy,
                        "preparedBy",
                        180
                );

        ReleaseSource source =
                loadReleaseSource(
                        findingId
                );

        policy.requireApprovedFinding(
                source.findingStatus(),
                source.findingEvidenceLineageCurrent()
        );

        Integer releasedCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_conclusion_packages
                        WHERE case_id = ?
                          AND status = 'RELEASED'
                        """,
                        Integer.class,
                        source.caseId()
                );

        if (
                releasedCount != null
                        && releasedCount > 0
        ) {
            throw new IllegalArgumentException(
                    "The investigation case already has a released conclusion package."
            );
        }

        Integer pendingCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_conclusion_packages
                        WHERE case_id = ?
                          AND status = 'PENDING'
                        """,
                        Integer.class,
                        source.caseId()
                );

        if (
                pendingCount != null
                        && pendingCount > 0
        ) {
            throw new IllegalArgumentException(
                    "The investigation case already has a pending conclusion package."
            );
        }

        Integer packageVersion =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            MAX(package_version),
                            0
                        ) + 1
                        FROM investigation_conclusion_packages
                        WHERE case_id = ?
                        """,
                        Integer.class,
                        source.caseId()
                );

        if (
                packageVersion == null
        ) {
            packageVersion =
                    1;
        }

        UUID packageId =
                UUID.randomUUID();

        Instant preparedAt =
                Instant.now();

        ConclusionReleaseFingerprint.Snapshot
                snapshot =
                snapshot(
                        source,
                        packageVersion,
                        summary,
                        rationale,
                        actor
                );

        String releaseFingerprint =
                fingerprint.hash(
                        snapshot
                );

        jdbcTemplate.update(
                """
                INSERT INTO investigation_conclusion_packages (
                    id,
                    case_id,
                    package_version,
                    finding_id,
                    finding_version,
                    finding_reference,
                    finding_title,
                    finding_narrative,
                    finding_review_id,
                    finding_reviewed_by,
                    evidence_id,
                    evidence_review_id,
                    evidence_review_version,
                    evidence_registry_fingerprint,
                    evidence_custody_head_hash,
                    outcome_execution_id,
                    outcome_proposal_id,
                    outcome_decision_version,
                    governed_outcome,
                    outcome_attestation_id,
                    outcome_provenance_hash,
                    outcome_audit_root_hash,
                    conclusion_summary,
                    release_rationale,
                    release_fingerprint,
                    status,
                    prepared_by,
                    prepared_at
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'PENDING',
                    ?,
                    ?
                )
                """,
                packageId,
                source.caseId(),
                packageVersion,
                source.findingId(),
                source.findingVersion(),
                source.findingReference(),
                source.findingTitle(),
                source.findingNarrative(),
                source.findingReviewId(),
                source.findingReviewedBy(),
                source.evidenceId(),
                source.evidenceReviewId(),
                source.evidenceReviewVersion(),
                source.evidenceRegistryFingerprint(),
                source.evidenceCustodyHeadHash(),
                source.outcomeExecutionId(),
                source.outcomeProposalId(),
                source.outcomeDecisionVersion(),
                source.governedOutcome(),
                source.outcomeAttestationId(),
                source.outcomeProvenanceHash(),
                source.outcomeAuditRootHash(),
                summary,
                rationale,
                releaseFingerprint,
                actor,
                Timestamp.from(
                        preparedAt
                )
        );

        return findById(
                packageId
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public PackageView review(
            UUID packageId,
            String decision,
            String reviewNote,
            String reviewedBy
    ) {
        if (
                packageId == null
        ) {
            throw new IllegalArgumentException(
                    "packageId is required."
            );
        }

        PackageState state =
                loadPackageState(
                        packageId
                );

        if (
                !"PENDING".equals(
                        state.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "Only pending conclusion packages may be reviewed."
            );
        }

        String actor =
                requireText(
                        reviewedBy,
                        "reviewedBy",
                        180
                );

        policy.requireIndependentReviewer(
                state.preparedBy(),
                actor
        );

        String normalizedDecision =
                policy.decision(
                        decision
                );

        String note =
                requireText(
                        reviewNote,
                        "reviewNote",
                        2000
                );

        IntegrityState integrity =
                integrity(
                        state
                );

        if (
                "RELEASED".equals(
                        normalizedDecision
                )
        ) {
            policy.requireReleasableIntegrity(
                    integrity.fingerprintValid(),
                    integrity.findingLineageCurrent(),
                    integrity.outcomeLineageCurrent()
            );
        }

        UUID reviewId =
                UUID.randomUUID();

        Instant reviewedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO investigation_conclusion_release_reviews (
                    id,
                    package_id,
                    decision,
                    review_note,
                    reviewed_by,
                    reviewed_at
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
                reviewId,
                packageId,
                normalizedDecision,
                note,
                actor,
                Timestamp.from(
                        reviewedAt
                )
        );

        jdbcTemplate.update(
                """
                UPDATE investigation_conclusion_packages
                SET status = ?
                WHERE id = ?
                  AND status = 'PENDING'
                """,
                normalizedDecision,
                packageId
        );

        return findById(
                packageId
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<PackageView> packages() {
        return loadPackageStates(
                packageQuery()
                        + """
                        ORDER BY
                            p.prepared_at DESC,
                            p.package_version DESC,
                            p.id
                        """,
                new Object[0]
        )
                .stream()
                .map(
                        this::toView
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<PackageView> caseHistory(
            UUID caseId
    ) {
        if (
                caseId == null
        ) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        return loadPackageStates(
                packageQuery()
                        + """
                        WHERE p.case_id = ?
                        ORDER BY p.package_version DESC
                        """,
                new Object[] {
                        caseId
                }
        )
                .stream()
                .map(
                        this::toView
                )
                .toList();
    }

    private ReleaseSource loadReleaseSource(
            UUID findingId
    ) {
        ReleaseSource value =
                jdbcTemplate.query(
                        """
                        SELECT f.id AS finding_id,
                               f.case_id,
                               f.finding_reference,
                               f.finding_version,
                               f.title AS finding_title,
                               f.narrative AS finding_narrative,
                               f.status AS finding_status,

                               fr.id AS finding_review_id,
                               fr.reviewed_by AS finding_reviewed_by,

                               f.evidence_id,
                               f.evidence_review_id,
                               f.evidence_review_version,
                               f.evidence_registry_fingerprint,
                               f.evidence_custody_head_hash,

                               o.execution_id AS outcome_execution_id,
                               o.proposal_id AS outcome_proposal_id,
                               o.decision_version
                                   AS outcome_decision_version,
                               o.governed_outcome,

                               a.id AS outcome_attestation_id,
                               a.provenance_hash
                                   AS outcome_provenance_hash,
                               a.audit_root_hash
                                   AS outcome_audit_root_hash,

                               CASE
                                   WHEN f.status = 'APPROVED'
                                    AND e.current_status = 'VERIFIED'
                                    AND e.registry_fingerprint
                                        = f.evidence_registry_fingerprint
                                    AND (
                                        SELECT ce.event_hash
                                        FROM investigation_evidence_custody_events ce
                                        WHERE ce.evidence_id = e.id
                                        ORDER BY ce.sequence_number DESC
                                        LIMIT 1
                                    ) = f.evidence_custody_head_hash
                                    AND er.id = f.evidence_review_id
                                    AND er.review_decision
                                        = 'ACCEPTED_FOR_ANALYSIS'
                                    AND er.registry_fingerprint
                                        = f.evidence_registry_fingerprint
                                    AND er.custody_head_hash
                                        = f.evidence_custody_head_hash
                                   THEN TRUE
                                   ELSE FALSE
                               END AS finding_evidence_lineage_current

                        FROM investigation_findings f

                        JOIN investigation_finding_reviews fr
                          ON fr.finding_id = f.id
                         AND fr.decision = 'APPROVED'

                        JOIN investigation_evidence_registry e
                          ON e.id = f.evidence_id

                        JOIN investigation_evidence_reviews er
                          ON er.id = f.evidence_review_id

                        JOIN governed_case_outcomes o
                          ON o.case_id = f.case_id

                        JOIN case_outcome_attestations a
                          ON a.execution_id = o.execution_id

                        WHERE f.id = ?
                          AND EXISTS (
                              SELECT 1
                              FROM case_outcome_attestation_verifications av
                              WHERE av.attestation_id = a.id
                                AND av.provenance_valid = TRUE
                                AND av.audit_anchor_present = TRUE
                                AND av.integrity_valid = TRUE
                          )
                          AND EXISTS (
                              SELECT 1
                              FROM security_audit_ledger_entries le
                              WHERE le.chain_hash = a.audit_root_hash
                          )

                        ORDER BY a.attested_at DESC
                        LIMIT 1
                        """,
                        resultSet -> {
                            if (
                                    !resultSet.next()
                            ) {
                                return null;
                            }

                            return new ReleaseSource(
                                    resultSet.getObject(
                                            "case_id",
                                            UUID.class
                                    ),
                                    resultSet.getObject(
                                            "finding_id",
                                            UUID.class
                                    ),
                                    resultSet.getInt(
                                            "finding_version"
                                    ),
                                    resultSet.getString(
                                            "finding_reference"
                                    ),
                                    resultSet.getString(
                                            "finding_title"
                                    ),
                                    resultSet.getString(
                                            "finding_narrative"
                                    ),
                                    resultSet.getString(
                                            "finding_status"
                                    ),
                                    resultSet.getObject(
                                            "finding_review_id",
                                            UUID.class
                                    ),
                                    resultSet.getString(
                                            "finding_reviewed_by"
                                    ),
                                    resultSet.getObject(
                                            "evidence_id",
                                            UUID.class
                                    ),
                                    resultSet.getObject(
                                            "evidence_review_id",
                                            UUID.class
                                    ),
                                    resultSet.getInt(
                                            "evidence_review_version"
                                    ),
                                    resultSet.getString(
                                            "evidence_registry_fingerprint"
                                    ),
                                    resultSet.getString(
                                            "evidence_custody_head_hash"
                                    ),
                                    resultSet.getObject(
                                            "outcome_execution_id",
                                            UUID.class
                                    ),
                                    resultSet.getObject(
                                            "outcome_proposal_id",
                                            UUID.class
                                    ),
                                    resultSet.getInt(
                                            "outcome_decision_version"
                                    ),
                                    resultSet.getString(
                                            "governed_outcome"
                                    ),
                                    resultSet.getObject(
                                            "outcome_attestation_id",
                                            UUID.class
                                    ),
                                    resultSet.getString(
                                            "outcome_provenance_hash"
                                    ),
                                    resultSet.getString(
                                            "outcome_audit_root_hash"
                                    ),
                                    resultSet.getBoolean(
                                            "finding_evidence_lineage_current"
                                    )
                            );
                        },
                        findingId
                );

        if (
                value == null
        ) {
            throw new IllegalArgumentException(
                    "Approved finding does not have complete governed-outcome provenance."
            );
        }

        return value;
    }

    private ConclusionReleaseFingerprint.Snapshot snapshot(
            ReleaseSource source,
            int packageVersion,
            String conclusionSummary,
            String releaseRationale,
            String preparedBy
    ) {
        return new ConclusionReleaseFingerprint.Snapshot(
                source.caseId(),
                packageVersion,
                source.findingId(),
                source.findingVersion(),
                source.findingReference(),
                source.findingTitle(),
                source.findingNarrative(),
                source.findingReviewId(),
                source.findingReviewedBy(),
                source.evidenceId(),
                source.evidenceReviewId(),
                source.evidenceReviewVersion(),
                source.evidenceRegistryFingerprint(),
                source.evidenceCustodyHeadHash(),
                source.outcomeExecutionId(),
                source.outcomeProposalId(),
                source.outcomeDecisionVersion(),
                source.governedOutcome(),
                source.outcomeAttestationId(),
                source.outcomeProvenanceHash(),
                source.outcomeAuditRootHash(),
                conclusionSummary,
                releaseRationale,
                preparedBy
        );
    }

    private ConclusionReleaseFingerprint.Snapshot snapshot(
            PackageState state
    ) {
        return new ConclusionReleaseFingerprint.Snapshot(
                state.caseId(),
                state.packageVersion(),
                state.findingId(),
                state.findingVersion(),
                state.findingReference(),
                state.findingTitle(),
                state.findingNarrative(),
                state.findingReviewId(),
                state.findingReviewedBy(),
                state.evidenceId(),
                state.evidenceReviewId(),
                state.evidenceReviewVersion(),
                state.evidenceRegistryFingerprint(),
                state.evidenceCustodyHeadHash(),
                state.outcomeExecutionId(),
                state.outcomeProposalId(),
                state.outcomeDecisionVersion(),
                state.governedOutcome(),
                state.outcomeAttestationId(),
                state.outcomeProvenanceHash(),
                state.outcomeAuditRootHash(),
                state.conclusionSummary(),
                state.releaseRationale(),
                state.preparedBy()
        );
    }

    private IntegrityState integrity(
            PackageState state
    ) {
        String expectedFingerprint =
                fingerprint.hash(
                        snapshot(
                                state
                        )
                );

        boolean fingerprintValid =
                expectedFingerprint.equals(
                        state.releaseFingerprint()
                );

        Integer findingLineageCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_findings f
                        JOIN investigation_finding_reviews fr
                          ON fr.finding_id = f.id
                        JOIN investigation_evidence_registry e
                          ON e.id = f.evidence_id
                        JOIN investigation_evidence_reviews er
                          ON er.id = f.evidence_review_id
                        WHERE f.id = ?
                          AND f.case_id = ?
                          AND f.finding_version = ?
                          AND f.status = 'APPROVED'
                          AND fr.id = ?
                          AND fr.decision = 'APPROVED'
                          AND e.id = ?
                          AND e.current_status = 'VERIFIED'
                          AND e.registry_fingerprint = ?
                          AND er.id = ?
                          AND er.review_version = ?
                          AND er.review_decision
                              = 'ACCEPTED_FOR_ANALYSIS'
                          AND er.registry_fingerprint = ?
                          AND er.custody_head_hash = ?
                          AND (
                              SELECT ce.event_hash
                              FROM investigation_evidence_custody_events ce
                              WHERE ce.evidence_id = e.id
                              ORDER BY ce.sequence_number DESC
                              LIMIT 1
                          ) = ?
                        """,
                        Integer.class,
                        state.findingId(),
                        state.caseId(),
                        state.findingVersion(),
                        state.findingReviewId(),
                        state.evidenceId(),
                        state.evidenceRegistryFingerprint(),
                        state.evidenceReviewId(),
                        state.evidenceReviewVersion(),
                        state.evidenceRegistryFingerprint(),
                        state.evidenceCustodyHeadHash(),
                        state.evidenceCustodyHeadHash()
                );

        boolean findingLineageCurrent =
                findingLineageCount != null
                        && findingLineageCount == 1;

        Integer outcomeLineageCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM governed_case_outcomes o

                        JOIN case_decision_executions de
                          ON de.id = o.execution_id

                        JOIN case_outcome_attestations a
                          ON a.execution_id = o.execution_id

                        WHERE o.case_id = ?
                          AND o.execution_id = ?
                          AND o.proposal_id = ?
                          AND o.decision_version = ?
                          AND o.governed_outcome = ?

                          AND de.id = ?
                          AND de.proposal_id = ?
                          AND de.decision_version = ?
                          AND de.governed_outcome = ?

                          AND a.id = ?
                          AND a.provenance_hash = ?
                          AND a.audit_root_hash = ?

                          AND EXISTS (
                              SELECT 1
                              FROM case_outcome_attestation_verifications av
                              WHERE av.attestation_id = a.id
                                AND av.provenance_valid = TRUE
                                AND av.audit_anchor_present = TRUE
                                AND av.integrity_valid = TRUE
                          )

                          AND EXISTS (
                              SELECT 1
                              FROM security_audit_ledger_entries le
                              WHERE le.chain_hash = a.audit_root_hash
                          )
                        """,
                        Integer.class,
                        state.caseId(),
                        state.outcomeExecutionId(),
                        state.outcomeProposalId(),
                        state.outcomeDecisionVersion(),
                        state.governedOutcome(),
                        state.outcomeExecutionId(),
                        state.outcomeProposalId(),
                        state.outcomeDecisionVersion(),
                        state.governedOutcome(),
                        state.outcomeAttestationId(),
                        state.outcomeProvenanceHash(),
                        state.outcomeAuditRootHash()
                );

        boolean outcomeLineageCurrent =
                outcomeLineageCount != null
                        && outcomeLineageCount == 1;

        return new IntegrityState(
                fingerprintValid,
                findingLineageCurrent,
                outcomeLineageCurrent,
                fingerprintValid
                        && findingLineageCurrent
                        && outcomeLineageCurrent
        );
    }

    private PackageView findById(
            UUID packageId
    ) {
        List<PackageState> states =
                loadPackageStates(
                        packageQuery()
                                + """
                                WHERE p.id = ?
                                """,
                        new Object[] {
                                packageId
                        }
                );

        if (
                states.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Conclusion release package not found: "
                            + packageId
            );
        }

        return toView(
                states.getFirst()
        );
    }

    private PackageState loadPackageState(
            UUID packageId
    ) {
        List<PackageState> states =
                loadPackageStates(
                        packageQuery()
                                + """
                                WHERE p.id = ?
                                """,
                        new Object[] {
                                packageId
                        }
                );

        if (
                states.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Conclusion release package not found: "
                            + packageId
            );
        }

        return states.getFirst();
    }

    private List<PackageState> loadPackageStates(
            String sql,
            Object[] arguments
    ) {
        return jdbcTemplate.query(
                sql,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    UUID releaseReviewId =
                            resultSet.getObject(
                                    "release_review_id",
                                    UUID.class
                            );

                    Timestamp reviewedAt =
                            resultSet.getTimestamp(
                                    "reviewed_at"
                            );

                    return new PackageState(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "case_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "case_number"
                            ),
                            resultSet.getInt(
                                    "package_version"
                            ),
                            resultSet.getObject(
                                    "finding_id",
                                    UUID.class
                            ),
                            resultSet.getInt(
                                    "finding_version"
                            ),
                            resultSet.getString(
                                    "finding_reference"
                            ),
                            resultSet.getString(
                                    "finding_title"
                            ),
                            resultSet.getString(
                                    "finding_narrative"
                            ),
                            resultSet.getObject(
                                    "finding_review_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "finding_reviewed_by"
                            ),
                            resultSet.getObject(
                                    "evidence_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "evidence_review_id",
                                    UUID.class
                            ),
                            resultSet.getInt(
                                    "evidence_review_version"
                            ),
                            resultSet.getString(
                                    "evidence_registry_fingerprint"
                            ),
                            resultSet.getString(
                                    "evidence_custody_head_hash"
                            ),
                            resultSet.getObject(
                                    "outcome_execution_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "outcome_proposal_id",
                                    UUID.class
                            ),
                            resultSet.getInt(
                                    "outcome_decision_version"
                            ),
                            resultSet.getString(
                                    "governed_outcome"
                            ),
                            resultSet.getObject(
                                    "outcome_attestation_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "outcome_provenance_hash"
                            ),
                            resultSet.getString(
                                    "outcome_audit_root_hash"
                            ),
                            resultSet.getString(
                                    "conclusion_summary"
                            ),
                            resultSet.getString(
                                    "release_rationale"
                            ),
                            resultSet.getString(
                                    "release_fingerprint"
                            ),
                            resultSet.getString(
                                    "status"
                            ),
                            resultSet.getString(
                                    "prepared_by"
                            ),
                            resultSet
                                    .getTimestamp(
                                            "prepared_at"
                                    )
                                    .toInstant(),
                            releaseReviewId,
                            resultSet.getString(
                                    "release_decision"
                            ),
                            resultSet.getString(
                                    "review_note"
                            ),
                            resultSet.getString(
                                    "reviewed_by"
                            ),
                            reviewedAt == null
                                    ? null
                                    : reviewedAt.toInstant()
                    );
                },
                arguments
        );
    }

    private String packageQuery() {
        return """
                SELECT p.id,
                       p.case_id,
                       c.case_number,
                       p.package_version,

                       p.finding_id,
                       p.finding_version,
                       p.finding_reference,
                       p.finding_title,
                       p.finding_narrative,
                       p.finding_review_id,
                       p.finding_reviewed_by,

                       p.evidence_id,
                       p.evidence_review_id,
                       p.evidence_review_version,
                       p.evidence_registry_fingerprint,
                       p.evidence_custody_head_hash,

                       p.outcome_execution_id,
                       p.outcome_proposal_id,
                       p.outcome_decision_version,
                       p.governed_outcome,

                       p.outcome_attestation_id,
                       p.outcome_provenance_hash,
                       p.outcome_audit_root_hash,

                       p.conclusion_summary,
                       p.release_rationale,
                       p.release_fingerprint,
                       p.status,
                       p.prepared_by,
                       p.prepared_at,

                       rr.id AS release_review_id,
                       rr.decision AS release_decision,
                       rr.review_note,
                       rr.reviewed_by,
                       rr.reviewed_at

                FROM investigation_conclusion_packages p

                JOIN investigation_cases c
                  ON c.id = p.case_id

                LEFT JOIN investigation_conclusion_release_reviews rr
                  ON rr.package_id = p.id
                """;
    }

    private PackageView toView(
            PackageState state
    ) {
        IntegrityState integrity =
                integrity(
                        state
                );

        return new PackageView(
                state.id()
                        .toString(),
                state.caseId()
                        .toString(),
                state.caseNumber(),
                state.packageVersion(),
                state.findingId()
                        .toString(),
                state.findingVersion(),
                state.findingReference(),
                state.findingTitle(),
                state.findingNarrative(),
                state.findingReviewId()
                        .toString(),
                state.findingReviewedBy(),
                state.evidenceId()
                        .toString(),
                state.evidenceReviewId()
                        .toString(),
                state.evidenceReviewVersion(),
                state.evidenceRegistryFingerprint(),
                state.evidenceCustodyHeadHash(),
                state.outcomeExecutionId()
                        .toString(),
                state.outcomeProposalId()
                        .toString(),
                state.outcomeDecisionVersion(),
                state.governedOutcome(),
                state.outcomeAttestationId()
                        .toString(),
                state.outcomeProvenanceHash(),
                state.outcomeAuditRootHash(),
                state.conclusionSummary(),
                state.releaseRationale(),
                state.releaseFingerprint(),
                state.status(),
                state.preparedBy(),
                state.preparedAt(),
                state.releaseReviewId() == null
                        ? null
                        : state.releaseReviewId()
                        .toString(),
                state.releaseDecision(),
                state.reviewNote(),
                state.reviewedBy(),
                state.reviewedAt(),
                integrity.fingerprintValid(),
                integrity.findingLineageCurrent(),
                integrity.outcomeLineageCurrent(),
                integrity.sourceLineageCurrent()
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

    private record ReleaseSource(
            UUID caseId,
            UUID findingId,
            int findingVersion,
            String findingReference,
            String findingTitle,
            String findingNarrative,
            String findingStatus,
            UUID findingReviewId,
            String findingReviewedBy,
            UUID evidenceId,
            UUID evidenceReviewId,
            int evidenceReviewVersion,
            String evidenceRegistryFingerprint,
            String evidenceCustodyHeadHash,
            UUID outcomeExecutionId,
            UUID outcomeProposalId,
            int outcomeDecisionVersion,
            String governedOutcome,
            UUID outcomeAttestationId,
            String outcomeProvenanceHash,
            String outcomeAuditRootHash,
            boolean findingEvidenceLineageCurrent
    ) {
    }

    private record IntegrityState(
            boolean fingerprintValid,
            boolean findingLineageCurrent,
            boolean outcomeLineageCurrent,
            boolean sourceLineageCurrent
    ) {
    }

    private record PackageState(
            UUID id,
            UUID caseId,
            String caseNumber,
            int packageVersion,
            UUID findingId,
            int findingVersion,
            String findingReference,
            String findingTitle,
            String findingNarrative,
            UUID findingReviewId,
            String findingReviewedBy,
            UUID evidenceId,
            UUID evidenceReviewId,
            int evidenceReviewVersion,
            String evidenceRegistryFingerprint,
            String evidenceCustodyHeadHash,
            UUID outcomeExecutionId,
            UUID outcomeProposalId,
            int outcomeDecisionVersion,
            String governedOutcome,
            UUID outcomeAttestationId,
            String outcomeProvenanceHash,
            String outcomeAuditRootHash,
            String conclusionSummary,
            String releaseRationale,
            String releaseFingerprint,
            String status,
            String preparedBy,
            Instant preparedAt,
            UUID releaseReviewId,
            String releaseDecision,
            String reviewNote,
            String reviewedBy,
            Instant reviewedAt
    ) {
    }

    public record PackageView(
            String id,
            String caseId,
            String caseNumber,
            int packageVersion,
            String findingId,
            int findingVersion,
            String findingReference,
            String findingTitle,
            String findingNarrative,
            String findingReviewId,
            String findingReviewedBy,
            String evidenceId,
            String evidenceReviewId,
            int evidenceReviewVersion,
            String evidenceRegistryFingerprint,
            String evidenceCustodyHeadHash,
            String outcomeExecutionId,
            String outcomeProposalId,
            int outcomeDecisionVersion,
            String governedOutcome,
            String outcomeAttestationId,
            String outcomeProvenanceHash,
            String outcomeAuditRootHash,
            String conclusionSummary,
            String releaseRationale,
            String releaseFingerprint,
            String status,
            String preparedBy,
            Instant preparedAt,
            String releaseReviewId,
            String releaseDecision,
            String reviewNote,
            String reviewedBy,
            Instant reviewedAt,
            boolean fingerprintValid,
            boolean findingLineageCurrent,
            boolean outcomeLineageCurrent,
            boolean sourceLineageCurrent
    ) {
    }
}
