package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DecisionGovernanceService {

    private final JdbcTemplate jdbcTemplate;
    private final DecisionGovernancePolicy policy;

    public DecisionGovernanceService(
            JdbcTemplate jdbcTemplate,
            DecisionGovernancePolicy policy
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.policy = policy;
    }

    @Transactional(transactionManager = "transactionManager")
    public DecisionView submit(
            UUID caseId,
            String recommendation,
            String rationale,
            String proposedBy
    ) {
        if (caseId == null) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        String normalizedRecommendation =
                policy.recommendation(recommendation);

        String normalizedRationale =
                requireText(
                        rationale,
                        "rationale",
                        2000
                );

        String actor =
                requireText(
                        proposedBy,
                        "proposedBy",
                        180
                );

        ensureCaseExists(caseId);

        Integer pendingCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM case_decision_proposals
                        WHERE case_id = ?
                          AND status = 'PENDING'
                        """,
                        Integer.class,
                        caseId
                );

        if (pendingCount != null && pendingCount > 0) {
            throw new IllegalArgumentException(
                    "The case already has a pending decision proposal."
            );
        }

        Integer version =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COALESCE(MAX(version), 0) + 1
                        FROM case_decision_proposals
                        WHERE case_id = ?
                        """,
                        Integer.class,
                        caseId
                );

        if (version == null) {
            version = 1;
        }

        UUID proposalId =
                UUID.randomUUID();

        Instant proposedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO case_decision_proposals (
                    id,
                    case_id,
                    version,
                    recommendation,
                    rationale,
                    status,
                    proposed_by,
                    proposed_at
                )
                VALUES (?, ?, ?, ?, ?, 'PENDING', ?, ?)
                """,
                proposalId,
                caseId,
                version,
                normalizedRecommendation,
                normalizedRationale,
                actor,
                Timestamp.from(proposedAt)
        );

        return findById(proposalId);
    }

    @Transactional(transactionManager = "transactionManager")
    public DecisionView review(
            UUID proposalId,
            String decision,
            String reviewNote,
            String reviewedBy
    ) {
        if (proposalId == null) {
            throw new IllegalArgumentException(
                    "proposalId is required."
            );
        }

        String normalizedDecision =
                policy.reviewDecision(decision);

        String normalizedReviewNote =
                requireText(
                        reviewNote,
                        "reviewNote",
                        2000
                );

        String reviewer =
                requireText(
                        reviewedBy,
                        "reviewedBy",
                        180
                );

        ProposalState state =
                jdbcTemplate.query(
                        """
                        SELECT id,
                               proposed_by,
                               status
                        FROM case_decision_proposals
                        WHERE id = ?
                        """,
                        resultSet -> {
                            if (!resultSet.next()) {
                                return null;
                            }

                            return new ProposalState(
                                    resultSet.getObject(
                                            "id",
                                            UUID.class
                                    ),
                                    resultSet.getString(
                                            "proposed_by"
                                    ),
                                    resultSet.getString(
                                            "status"
                                    )
                            );
                        },
                        proposalId
                );

        if (state == null) {
            throw new IllegalArgumentException(
                    "Decision proposal not found: "
                            + proposalId
            );
        }

        if (!"PENDING".equals(state.status())) {
            throw new IllegalArgumentException(
                    "Only pending decision proposals can be reviewed."
            );
        }

        policy.requireIndependentReviewer(
                state.proposedBy(),
                reviewer
        );

        Instant reviewedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO case_decision_reviews (
                    id,
                    proposal_id,
                    decision,
                    review_note,
                    reviewed_by,
                    reviewed_at
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(),
                proposalId,
                normalizedDecision,
                normalizedReviewNote,
                reviewer,
                Timestamp.from(reviewedAt)
        );

        jdbcTemplate.update(
                """
                UPDATE case_decision_proposals
                SET status = ?
                WHERE id = ?
                  AND status = 'PENDING'
                """,
                normalizedDecision,
                proposalId
        );

        return findById(proposalId);
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<DecisionView> pending() {
        return jdbcTemplate.query(
                baseQuery()
                        + """
                        WHERE p.status = 'PENDING'
                        ORDER BY p.proposed_at, p.id
                        """,
                this::mapDecision
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<DecisionView> recent() {
        return jdbcTemplate.query(
                baseQuery()
                        + """
                        ORDER BY
                            p.proposed_at DESC,
                            p.version DESC
                        LIMIT 50
                        """,
                this::mapDecision
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<DecisionView> caseHistory(
            UUID caseId
    ) {
        ensureCaseExists(caseId);

        return jdbcTemplate.query(
                baseQuery()
                        + """
                        WHERE p.case_id = ?
                        ORDER BY p.version DESC
                        """,
                this::mapDecision,
                caseId
        );
    }

    private DecisionView findById(UUID proposalId) {
        List<DecisionView> values =
                jdbcTemplate.query(
                        baseQuery()
                                + """
                                WHERE p.id = ?
                                """,
                        this::mapDecision,
                        proposalId
                );

        if (values.isEmpty()) {
            throw new IllegalArgumentException(
                    "Decision proposal not found: "
                            + proposalId
            );
        }

        return values.getFirst();
    }

    private String baseQuery() {
        return """
                SELECT p.id,
                       p.case_id,
                       c.case_number,
                       c.priority AS case_priority,
                       c.status AS case_status,
                       p.version,
                       p.recommendation,
                       p.rationale,
                       p.status,
                       p.proposed_by,
                       p.proposed_at,
                       r.id AS review_id,
                       r.decision,
                       r.review_note,
                       r.reviewed_by,
                       r.reviewed_at
                FROM case_decision_proposals p
                JOIN investigation_cases c
                  ON c.id = p.case_id
                LEFT JOIN case_decision_reviews r
                  ON r.proposal_id = p.id
                """;
    }

    private DecisionView mapDecision(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {

        UUID reviewId =
                resultSet.getObject(
                        "review_id",
                        UUID.class
                );

        Timestamp reviewedAt =
                resultSet.getTimestamp(
                        "reviewed_at"
                );

        return new DecisionView(
                resultSet.getObject(
                                "id",
                                UUID.class
                        )
                        .toString(),
                resultSet.getObject(
                                "case_id",
                                UUID.class
                        )
                        .toString(),
                resultSet.getString(
                        "case_number"
                ),
                resultSet.getString(
                        "case_priority"
                ),
                resultSet.getString(
                        "case_status"
                ),
                resultSet.getInt(
                        "version"
                ),
                resultSet.getString(
                        "recommendation"
                ),
                resultSet.getString(
                        "rationale"
                ),
                resultSet.getString(
                        "status"
                ),
                resultSet.getString(
                        "proposed_by"
                ),
                resultSet.getTimestamp(
                                "proposed_at"
                        )
                        .toInstant(),
                reviewId == null
                        ? null
                        : reviewId.toString(),
                resultSet.getString(
                        "decision"
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
    }

    private void ensureCaseExists(UUID caseId) {
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

        if (count == null || count != 1) {
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
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    field + " is required."
            );
        }

        String normalized =
                value.trim();

        if (normalized.length() > maxLength) {
            throw new IllegalArgumentException(
                    field
                            + " exceeds "
                            + maxLength
                            + " characters."
            );
        }

        return normalized;
    }

    private record ProposalState(
            UUID id,
            String proposedBy,
            String status
    ) {
    }

    public record DecisionView(
            String id,
            String caseId,
            String caseNumber,
            String casePriority,
            String caseStatus,
            int version,
            String recommendation,
            String rationale,
            String status,
            String proposedBy,
            Instant proposedAt,
            String reviewId,
            String decision,
            String reviewNote,
            String reviewedBy,
            Instant reviewedAt
    ) {
    }
}
