package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class DecisionExecutionService {

    private final JdbcTemplate jdbcTemplate;
    private final DecisionExecutionPolicy policy;

    public DecisionExecutionService(
            JdbcTemplate jdbcTemplate,
            DecisionExecutionPolicy policy
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.policy =
                policy;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public ExecutionView execute(
            UUID proposalId,
            String executionNote,
            String executedBy
    ) {
        if (
                proposalId == null
        ) {
            throw new IllegalArgumentException(
                    "proposalId is required."
            );
        }

        String note =
                requireText(
                        executionNote,
                        "executionNote",
                        2000
                );

        String actor =
                requireText(
                        executedBy,
                        "executedBy",
                        180
                );

        ProposalExecutionSource source =
                loadProposal(
                        proposalId
                );

        policy.requireApproved(
                source.status()
        );

        policy.requireReviewed(
                source.reviewedBy()
        );

        Integer executionCount =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM case_decision_executions
                        WHERE proposal_id = ?
                        """,
                        Integer.class,
                        proposalId
                );

        if (
                executionCount != null
                        && executionCount > 0
        ) {
            throw new IllegalArgumentException(
                    "The approved decision proposal has already been executed."
            );
        }

        String governedOutcome =
                policy.outcomeFor(
                        source.recommendation()
                );

        UUID executionId =
                UUID.randomUUID();

        Instant executedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO case_decision_executions (
                    id,
                    proposal_id,
                    case_id,
                    decision_version,
                    source_recommendation,
                    governed_outcome,
                    source_proposed_by,
                    source_reviewed_by,
                    execution_note,
                    executed_by,
                    executed_at
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
                executionId,
                proposalId,
                source.caseId(),
                source.version(),
                source.recommendation(),
                governedOutcome,
                source.proposedBy(),
                source.reviewedBy(),
                note,
                actor,
                Timestamp.from(
                        executedAt
                )
        );

        jdbcTemplate.update(
                """
                INSERT INTO governed_case_outcomes (
                    case_id,
                    execution_id,
                    proposal_id,
                    decision_version,
                    governed_outcome,
                    effective_at,
                    last_updated_by
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                ON CONFLICT (case_id)
                DO UPDATE SET
                    execution_id = EXCLUDED.execution_id,
                    proposal_id = EXCLUDED.proposal_id,
                    decision_version = EXCLUDED.decision_version,
                    governed_outcome = EXCLUDED.governed_outcome,
                    effective_at = EXCLUDED.effective_at,
                    last_updated_by = EXCLUDED.last_updated_by
                """,
                source.caseId(),
                executionId,
                proposalId,
                source.version(),
                governedOutcome,
                Timestamp.from(
                        executedAt
                ),
                actor
        );

        return findExecution(
                executionId
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<ExecutionView> executions() {
        return jdbcTemplate.query(
                executionQuery()
                        + """
                        ORDER BY
                            e.executed_at DESC,
                            e.id
                        """,
                this::mapExecution
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<OutcomeView> outcomes() {
        return jdbcTemplate.query(
                """
                SELECT o.case_id,
                       c.case_number,
                       c.priority AS case_priority,
                       c.status AS case_status,
                       o.execution_id,
                       o.proposal_id,
                       o.decision_version,
                       o.governed_outcome,
                       o.effective_at,
                       o.last_updated_by
                FROM governed_case_outcomes o
                JOIN investigation_cases c
                  ON c.id = o.case_id
                ORDER BY
                    o.effective_at DESC,
                    c.case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new OutcomeView(
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
                                        .getTimestamp(
                                                "effective_at"
                                        )
                                        .toInstant(),
                                resultSet
                                        .getString(
                                                "last_updated_by"
                                        )
                        )
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public OutcomeView caseOutcome(
            UUID caseId
    ) {
        if (
                caseId == null
        ) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        List<OutcomeView> values =
                jdbcTemplate.query(
                        """
                        SELECT o.case_id,
                               c.case_number,
                               c.priority AS case_priority,
                               c.status AS case_status,
                               o.execution_id,
                               o.proposal_id,
                               o.decision_version,
                               o.governed_outcome,
                               o.effective_at,
                               o.last_updated_by
                        FROM governed_case_outcomes o
                        JOIN investigation_cases c
                          ON c.id = o.case_id
                        WHERE o.case_id = ?
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) ->
                                new OutcomeView(
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
                                                .getTimestamp(
                                                        "effective_at"
                                                )
                                                .toInstant(),
                                        resultSet
                                                .getString(
                                                        "last_updated_by"
                                                )
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

    private ProposalExecutionSource loadProposal(
            UUID proposalId
    ) {
        ProposalExecutionSource source =
                jdbcTemplate.query(
                        """
                        SELECT p.id,
                               p.case_id,
                               p.version,
                               p.recommendation,
                               p.status,
                               p.proposed_by,
                               r.reviewed_by
                        FROM case_decision_proposals p
                        LEFT JOIN case_decision_reviews r
                          ON r.proposal_id = p.id
                        WHERE p.id = ?
                        """,
                        resultSet -> {
                            if (
                                    !resultSet.next()
                            ) {
                                return null;
                            }

                            return new ProposalExecutionSource(
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
                                            .getInt(
                                                    "version"
                                            ),
                                    resultSet
                                            .getString(
                                                    "recommendation"
                                            ),
                                    resultSet
                                            .getString(
                                                    "status"
                                            ),
                                    resultSet
                                            .getString(
                                                    "proposed_by"
                                            ),
                                    resultSet
                                            .getString(
                                                    "reviewed_by"
                                            )
                            );
                        },
                        proposalId
                );

        if (
                source == null
        ) {
            throw new IllegalArgumentException(
                    "Decision proposal not found: "
                            + proposalId
            );
        }

        return source;
    }

    private ExecutionView findExecution(
            UUID executionId
    ) {
        List<ExecutionView> values =
                jdbcTemplate.query(
                        executionQuery()
                                + """
                                WHERE e.id = ?
                                """,
                        this::mapExecution,
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

    private String executionQuery() {
        return """
                SELECT e.id,
                       e.proposal_id,
                       e.case_id,
                       c.case_number,
                       c.priority AS case_priority,
                       c.status AS case_status,
                       e.decision_version,
                       e.source_recommendation,
                       e.governed_outcome,
                       e.source_proposed_by,
                       e.source_reviewed_by,
                       e.execution_note,
                       e.executed_by,
                       e.executed_at
                FROM case_decision_executions e
                JOIN investigation_cases c
                  ON c.id = e.case_id
                """;
    }

    private ExecutionView mapExecution(
            java.sql.ResultSet resultSet,
            int rowNumber
    ) throws java.sql.SQLException {

        return new ExecutionView(
                resultSet
                        .getObject(
                                "id",
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

    private record ProposalExecutionSource(
            UUID id,
            UUID caseId,
            int version,
            String recommendation,
            String status,
            String proposedBy,
            String reviewedBy
    ) {
    }

    public record ExecutionView(
            String id,
            String proposalId,
            String caseId,
            String caseNumber,
            String casePriority,
            String caseStatus,
            int decisionVersion,
            String sourceRecommendation,
            String governedOutcome,
            String sourceProposedBy,
            String sourceReviewedBy,
            String executionNote,
            String executedBy,
            Instant executedAt
    ) {
    }

    public record OutcomeView(
            String caseId,
            String caseNumber,
            String casePriority,
            String caseStatus,
            String executionId,
            String proposalId,
            int decisionVersion,
            String governedOutcome,
            Instant effectiveAt,
            String lastUpdatedBy
    ) {
    }
}
