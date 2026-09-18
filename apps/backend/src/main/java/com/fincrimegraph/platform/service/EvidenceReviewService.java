package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class EvidenceReviewService {

    private final JdbcTemplate jdbcTemplate;
    private final EvidenceReviewPolicy policy;

    public EvidenceReviewService(
            JdbcTemplate jdbcTemplate,
            EvidenceReviewPolicy policy
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.policy =
                policy;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public ReviewView review(
            UUID evidenceId,
            String reviewDecision,
            String reviewReason,
            String reviewedBy
    ) {
        if (
                evidenceId == null
        ) {
            throw new IllegalArgumentException(
                    "evidenceId is required."
            );
        }

        EvidenceState evidence =
                loadEvidence(
                        evidenceId
                );

        policy.requireVerifiedEvidence(
                evidence.currentStatus()
        );

        String actor =
                requireText(
                        reviewedBy,
                        "reviewedBy",
                        180
                );

        policy.requireIndependentReviewer(
                evidence.currentCustodian(),
                actor
        );

        String decision =
                policy.decision(
                        reviewDecision
                );

        String reason =
                requireText(
                        reviewReason,
                        "reviewReason",
                        2000
                );

        String custodyHeadHash =
                loadCustodyHeadHash(
                        evidence.id()
                );

        Integer duplicateLineageCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM investigation_evidence_reviews
                        WHERE evidence_id = ?
                          AND registry_fingerprint = ?
                          AND custody_head_hash = ?
                        """,
                        Integer.class,
                        evidence.id(),
                        evidence.registryFingerprint(),
                        custodyHeadHash
                );

        if (
                duplicateLineageCount != null
                        && duplicateLineageCount > 0
        ) {
            throw new IllegalArgumentException(
                    "The current evidence lineage already has an analytical-use review."
            );
        }

        Integer nextVersion =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(
                            MAX(review_version),
                            0
                        ) + 1
                        FROM investigation_evidence_reviews
                        WHERE evidence_id = ?
                        """,
                        Integer.class,
                        evidence.id()
                );

        if (
                nextVersion == null
        ) {
            nextVersion =
                    1;
        }

        UUID reviewId =
                UUID.randomUUID();

        Instant reviewedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO investigation_evidence_reviews (
                    id,
                    evidence_id,
                    review_version,
                    review_decision,
                    review_reason,
                    registry_fingerprint,
                    custody_head_hash,
                    reviewed_by,
                    reviewed_at
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
                    ?
                )
                """,
                reviewId,
                evidence.id(),
                nextVersion,
                decision,
                reason,
                evidence.registryFingerprint(),
                custodyHeadHash,
                actor,
                Timestamp.from(
                        reviewedAt
                )
        );

        return findReview(
                reviewId
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<ReviewView> reviews() {
        return jdbcTemplate.query(
                reviewQuery()
                        + """
                        ORDER BY
                            r.reviewed_at DESC,
                            r.review_version DESC,
                            r.id
                        """,
                this::mapReview
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<ReviewView> evidenceHistory(
            UUID evidenceId
    ) {
        loadEvidence(
                evidenceId
        );

        return jdbcTemplate.query(
                reviewQuery()
                        + """
                        WHERE r.evidence_id = ?
                        ORDER BY r.review_version DESC
                        """,
                this::mapReview,
                evidenceId
        );
    }

    private ReviewView findReview(
            UUID reviewId
    ) {
        List<ReviewView> values =
                jdbcTemplate.query(
                        reviewQuery()
                                + """
                                WHERE r.id = ?
                                """,
                        this::mapReview,
                        reviewId
                );

        if (
                values.isEmpty()
        ) {
            throw new IllegalArgumentException(
                    "Evidence review not found: "
                            + reviewId
            );
        }

        return values.getFirst();
    }

    private EvidenceState loadEvidence(
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
                               title,
                               current_custodian,
                               current_status,
                               registry_fingerprint
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
                                                    "title"
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
                                                    "registry_fingerprint"
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

    private String loadCustodyHeadHash(
            UUID evidenceId
    ) {
        String value =
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
                                        : null,
                        evidenceId
                );

        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Evidence custody history does not contain a chain head."
            );
        }

        return value;
    }

    private String reviewQuery() {
        return """
                SELECT r.id,
                       r.evidence_id,
                       e.case_id,
                       c.case_number,
                       e.evidence_reference,
                       e.title,
                       e.current_custodian,
                       e.current_status,
                       r.review_version,
                       r.review_decision,
                       r.review_reason,
                       r.registry_fingerprint,
                       r.custody_head_hash,
                       r.reviewed_by,
                       r.reviewed_at,
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
                FROM investigation_evidence_reviews r
                JOIN investigation_evidence_registry e
                  ON e.id = r.evidence_id
                JOIN investigation_cases c
                  ON c.id = e.case_id
                """;
    }

    private ReviewView mapReview(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {
        return new ReviewView(
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
                                "title"
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
                        .getInt(
                                "review_version"
                        ),
                resultSet
                        .getString(
                                "review_decision"
                        ),
                resultSet
                        .getString(
                                "review_reason"
                        ),
                resultSet
                        .getString(
                                "registry_fingerprint"
                        ),
                resultSet
                        .getString(
                                "custody_head_hash"
                        ),
                resultSet
                        .getString(
                                "reviewed_by"
                        ),
                resultSet
                        .getTimestamp(
                                "reviewed_at"
                        )
                        .toInstant(),
                resultSet
                        .getBoolean(
                                "lineage_current"
                        )
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

    private record EvidenceState(
            UUID id,
            UUID caseId,
            String evidenceReference,
            String title,
            String currentCustodian,
            String currentStatus,
            String registryFingerprint
    ) {
    }

    public record ReviewView(
            String id,
            String evidenceId,
            String caseId,
            String caseNumber,
            String evidenceReference,
            String title,
            String currentCustodian,
            String currentStatus,
            int reviewVersion,
            String reviewDecision,
            String reviewReason,
            String registryFingerprint,
            String custodyHeadHash,
            String reviewedBy,
            Instant reviewedAt,
            boolean lineageCurrent
    ) {
    }
}
