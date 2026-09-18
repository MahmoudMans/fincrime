package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class InvestigationFindingService {

    private final JdbcTemplate jdbcTemplate;
    private final InvestigationFindingPolicy policy;

    public InvestigationFindingService(
            JdbcTemplate jdbcTemplate,
            InvestigationFindingPolicy policy
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.policy =
                policy;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public FindingView submit(
            UUID caseId,
            String findingReference,
            String title,
            String narrative,
            UUID evidenceId,
            String submittedBy
    ) {
        if (
                caseId == null
        ) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        if (
                evidenceId == null
        ) {
            throw new IllegalArgumentException(
                    "evidenceId is required."
            );
        }

        ensureCaseExists(
                caseId
        );

        String reference =
                requireText(
                        findingReference,
                        "findingReference",
                        160
                );

        String normalizedTitle =
                requireText(
                        title,
                        "title",
                        240
                );

        String normalizedNarrative =
                requireText(
                        narrative,
                        "narrative",
                        4000
                );

        String actor =
                requireText(
                        submittedBy,
                        "submittedBy",
                        180
                );

        AcceptedEvidenceSource source =
                loadAcceptedCurrentEvidence(
                        caseId,
                        evidenceId
                );

        policy.requireAcceptedEvidenceReview(
                source.evidenceStatus(),
                source.reviewDecision(),
                source.lineageCurrent()
        );

        Integer pendingCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_findings
                        WHERE case_id = ?
                          AND LOWER(finding_reference)
                              = LOWER(?)
                          AND status = 'PENDING'
                        """,
                        Integer.class,
                        caseId,
                        reference
                );

        if (
                pendingCount != null
                        && pendingCount > 0
        ) {
            throw new IllegalArgumentException(
                    "The finding reference already has a pending version."
            );
        }

        Integer nextVersion =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            MAX(finding_version),
                            0
                        ) + 1
                        FROM investigation_findings
                        WHERE case_id = ?
                          AND LOWER(finding_reference)
                              = LOWER(?)
                        """,
                        Integer.class,
                        caseId,
                        reference
                );

        if (
                nextVersion == null
        ) {
            nextVersion =
                    1;
        }

        UUID findingId =
                UUID.randomUUID();

        Instant submittedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO investigation_findings (
                    id,
                    case_id,
                    finding_reference,
                    finding_version,
                    title,
                    narrative,
                    evidence_id,
                    evidence_review_id,
                    evidence_review_version,
                    evidence_registry_fingerprint,
                    evidence_custody_head_hash,
                    status,
                    submitted_by,
                    submitted_at
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
                    'PENDING',
                    ?,
                    ?
                )
                """,
                findingId,
                caseId,
                reference,
                nextVersion,
                normalizedTitle,
                normalizedNarrative,
                source.evidenceId(),
                source.reviewId(),
                source.reviewVersion(),
                source.registryFingerprint(),
                source.custodyHeadHash(),
                actor,
                Timestamp.from(
                        submittedAt
                )
        );

        return findById(
                findingId
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public FindingView review(
            UUID findingId,
            String decision,
            String reviewNote,
            String reviewedBy
    ) {
        if (
                findingId == null
        ) {
            throw new IllegalArgumentException(
                    "findingId is required."
            );
        }

        FindingState finding =
                loadFindingState(
                        findingId
                );

        if (
                !"PENDING".equals(
                        finding.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "Only pending investigation findings may be reviewed."
            );
        }

        String actor =
                requireText(
                        reviewedBy,
                        "reviewedBy",
                        180
                );

        policy.requireIndependentReviewer(
                finding.submittedBy(),
                actor
        );

        String normalizedDecision =
                policy.reviewDecision(
                        decision
                );

        String note =
                requireText(
                        reviewNote,
                        "reviewNote",
                        2000
                );

        UUID reviewId =
                UUID.randomUUID();

        Instant reviewedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO investigation_finding_reviews (
                    id,
                    finding_id,
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
                findingId,
                normalizedDecision,
                note,
                actor,
                Timestamp.from(
                        reviewedAt
                )
        );

        jdbcTemplate.update(
                """
                UPDATE investigation_findings
                SET status = ?
                WHERE id = ?
                  AND status = 'PENDING'
                """,
                normalizedDecision,
                findingId
        );

        return findById(
                findingId
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<FindingView> findings() {
        return jdbcTemplate.query(
                findingQuery()
                        + """
                        ORDER BY
                            f.submitted_at DESC,
                            f.finding_version DESC,
                            f.id
                        """,
                this::mapFinding
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<FindingView> caseHistory(
            UUID caseId
    ) {
        ensureCaseExists(
                caseId
        );

        return jdbcTemplate.query(
                findingQuery()
                        + """
                        WHERE f.case_id = ?
                        ORDER BY
                            f.finding_reference,
                            f.finding_version DESC
                        """,
                this::mapFinding,
                caseId
        );
    }

    private AcceptedEvidenceSource
    loadAcceptedCurrentEvidence(
            UUID caseId,
            UUID evidenceId
    ) {
        AcceptedEvidenceSource value =
                jdbcTemplate.query(
                        """
                        SELECT e.id AS evidence_id,
                               e.case_id,
                               e.current_status,
                               e.registry_fingerprint,
                               r.id AS review_id,
                               r.review_version,
                               r.review_decision,
                               r.custody_head_hash,
                               CASE
                                   WHEN e.current_status = 'VERIFIED'
                                    AND e.registry_fingerprint
                                        = r.registry_fingerprint
                                    AND (
                                        SELECT ce.event_hash
                                        FROM investigation_evidence_custody_events ce
                                        WHERE ce.evidence_id = e.id
                                        ORDER BY ce.sequence_number DESC
                                        LIMIT 1
                                    ) = r.custody_head_hash
                                   THEN TRUE
                                   ELSE FALSE
                               END AS lineage_current
                        FROM investigation_evidence_registry e
                        JOIN investigation_evidence_reviews r
                          ON r.evidence_id = e.id
                        WHERE e.id = ?
                          AND e.case_id = ?
                          AND r.review_decision
                              = 'ACCEPTED_FOR_ANALYSIS'
                        ORDER BY
                            r.review_version DESC,
                            r.reviewed_at DESC
                        LIMIT 1
                        """,
                        resultSet -> {
                            if (
                                    !resultSet.next()
                            ) {
                                return null;
                            }

                            return new AcceptedEvidenceSource(
                                    resultSet
                                            .getObject(
                                                    "evidence_id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getObject(
                                                    "case_id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getString(
                                                    "current_status"
                                            ),
                                    resultSet
                                            .getString(
                                                    "registry_fingerprint"
                                            ),
                                    resultSet
                                            .getObject(
                                                    "review_id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getInt(
                                                    "review_version"
                                            ),
                                    resultSet
                                            .getString(
                                                    "review_decision"
                                            ),
                                    resultSet
                                            .getString(
                                                    "custody_head_hash"
                                            ),
                                    resultSet
                                            .getBoolean(
                                                    "lineage_current"
                                            )
                            );
                        },
                        evidenceId,
                        caseId
                );

        if (
                value == null
        ) {
            throw new IllegalArgumentException(
                    "Evidence does not have an ACCEPTED_FOR_ANALYSIS review for this investigation case."
            );
        }

        return value;
    }

    private FindingState loadFindingState(
            UUID findingId
    ) {
        FindingState value =
                jdbcTemplate.query(
                        """
                        SELECT id,
                               submitted_by,
                               status
                        FROM investigation_findings
                        WHERE id = ?
                        """,
                        resultSet -> {
                            if (
                                    !resultSet.next()
                            ) {
                                return null;
                            }

                            return new FindingState(
                                    resultSet
                                            .getObject(
                                                    "id",
                                                    UUID.class
                                            ),
                                    resultSet
                                            .getString(
                                                    "submitted_by"
                                            ),
                                    resultSet
                                            .getString(
                                                    "status"
                                            )
                            );
                        },
                        findingId
                );

        if (
                value == null
        ) {
            throw new IllegalArgumentException(
                    "Investigation finding not found: "
                            + findingId
            );
        }

        return value;
    }

    private FindingView findById(
            UUID findingId
    ) {
        List<FindingView> values =
                jdbcTemplate.query(
                        findingQuery()
                                + """
                                WHERE f.id = ?
                                """,
                        this::mapFinding,
                        findingId
                );

        if (
                values.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Investigation finding not found: "
                            + findingId
            );
        }

        return values.getFirst();
    }

    private String findingQuery() {
        return """
                SELECT f.id,
                       f.case_id,
                       c.case_number,
                       c.priority AS case_priority,
                       c.status AS case_status,
                       f.finding_reference,
                       f.finding_version,
                       f.title,
                       f.narrative,
                       f.evidence_id,
                       e.evidence_reference,
                       f.evidence_review_id,
                       f.evidence_review_version,
                       f.evidence_registry_fingerprint,
                       f.evidence_custody_head_hash,
                       f.status,
                       f.submitted_by,
                       f.submitted_at,
                       fr.id AS finding_review_id,
                       fr.decision AS finding_review_decision,
                       fr.review_note,
                       fr.reviewed_by,
                       fr.reviewed_at,
                       CASE
                           WHEN e.current_status = 'VERIFIED'
                            AND f.evidence_registry_fingerprint
                                = e.registry_fingerprint
                            AND f.evidence_custody_head_hash = (
                                SELECT ce.event_hash
                                FROM investigation_evidence_custody_events ce
                                WHERE ce.evidence_id = e.id
                                ORDER BY ce.sequence_number DESC
                                LIMIT 1
                            )
                            AND EXISTS (
                                SELECT 1
                                FROM investigation_evidence_reviews er
                                WHERE er.id = f.evidence_review_id
                                  AND er.evidence_id = f.evidence_id
                                  AND er.review_decision
                                      = 'ACCEPTED_FOR_ANALYSIS'
                                  AND er.registry_fingerprint
                                      = f.evidence_registry_fingerprint
                                  AND er.custody_head_hash
                                      = f.evidence_custody_head_hash
                            )
                           THEN TRUE
                           ELSE FALSE
                       END AS evidence_lineage_current
                FROM investigation_findings f
                JOIN investigation_cases c
                  ON c.id = f.case_id
                JOIN investigation_evidence_registry e
                  ON e.id = f.evidence_id
                LEFT JOIN investigation_finding_reviews fr
                  ON fr.finding_id = f.id
                """;
    }

    private FindingView mapFinding(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {

        UUID findingReviewId =
                resultSet.getObject(
                        "finding_review_id",
                        UUID.class
                );

        Timestamp reviewedAt =
                resultSet.getTimestamp(
                        "reviewed_at"
                );

        return new FindingView(
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
                                "case_priority"
                        ),
                resultSet
                        .getString(
                                "case_status"
                        ),
                resultSet
                        .getString(
                                "finding_reference"
                        ),
                resultSet
                        .getInt(
                                "finding_version"
                        ),
                resultSet
                        .getString(
                                "title"
                        ),
                resultSet
                        .getString(
                                "narrative"
                        ),
                resultSet
                        .getObject(
                                "evidence_id",
                                UUID.class
                        )
                        .toString(),
                resultSet
                        .getString(
                                "evidence_reference"
                        ),
                resultSet
                        .getObject(
                                "evidence_review_id",
                                UUID.class
                        )
                        .toString(),
                resultSet
                        .getInt(
                                "evidence_review_version"
                        ),
                resultSet
                        .getString(
                                "evidence_registry_fingerprint"
                        ),
                resultSet
                        .getString(
                                "evidence_custody_head_hash"
                        ),
                resultSet
                        .getString(
                                "status"
                        ),
                resultSet
                        .getString(
                                "submitted_by"
                        ),
                resultSet
                        .getTimestamp(
                                "submitted_at"
                        )
                        .toInstant(),
                findingReviewId == null
                        ? null
                        : findingReviewId.toString(),
                resultSet
                        .getString(
                                "finding_review_decision"
                        ),
                resultSet
                        .getString(
                                "review_note"
                        ),
                resultSet
                        .getString(
                                "reviewed_by"
                        ),
                reviewedAt == null
                        ? null
                        : reviewedAt.toInstant(),
                resultSet
                        .getBoolean(
                                "evidence_lineage_current"
                        )
        );
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

    private record AcceptedEvidenceSource(
            UUID evidenceId,
            UUID caseId,
            String evidenceStatus,
            String registryFingerprint,
            UUID reviewId,
            int reviewVersion,
            String reviewDecision,
            String custodyHeadHash,
            boolean lineageCurrent
    ) {
    }

    private record FindingState(
            UUID id,
            String submittedBy,
            String status
    ) {
    }

    public record FindingView(
            String id,
            String caseId,
            String caseNumber,
            String casePriority,
            String caseStatus,
            String findingReference,
            int findingVersion,
            String title,
            String narrative,
            String evidenceId,
            String evidenceReference,
            String evidenceReviewId,
            int evidenceReviewVersion,
            String evidenceRegistryFingerprint,
            String evidenceCustodyHeadHash,
            String status,
            String submittedBy,
            Instant submittedAt,
            String findingReviewId,
            String findingReviewDecision,
            String reviewNote,
            String reviewedBy,
            Instant reviewedAt,
            boolean evidenceLineageCurrent
    ) {
    }
}
