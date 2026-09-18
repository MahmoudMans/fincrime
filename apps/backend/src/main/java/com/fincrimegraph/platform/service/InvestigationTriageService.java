package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class InvestigationTriageService {

    private final JdbcTemplate jdbcTemplate;
    private final InvestigationTriageScorer scorer;

    public InvestigationTriageService(
            JdbcTemplate jdbcTemplate,
            InvestigationTriageScorer scorer
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.scorer =
                scorer;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public TriageRunView recalculate(
            String calculatedBy
    ) {
        String actor =
                requireText(
                        calculatedBy,
                        "calculatedBy"
                );

        Instant calculatedAt =
                Instant.now();

        UUID runId =
                UUID.randomUUID();

        List<CaseInput> cases =
                jdbcTemplate.query(
                        """
                        SELECT c.id,
                               c.case_number,
                               c.priority,
                               c.status,
                               c.created_at,
                               s.target_hours,
                               s.elapsed_hours,
                               s.breach_hours,
                               s.sla_state
                        FROM investigation_cases c
                        LEFT JOIN case_sla_status s
                          ON s.case_id = c.id
                        ORDER BY
                            c.created_at,
                            c.case_number
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) -> {
                            Timestamp createdAt =
                                    resultSet.getTimestamp(
                                            "created_at"
                                    );

                            Integer targetHours =
                                    nullableInteger(
                                            resultSet,
                                            "target_hours"
                                    );

                            Long elapsedHours =
                                    nullableLong(
                                            resultSet,
                                            "elapsed_hours"
                                    );

                            Long breachHours =
                                    nullableLong(
                                            resultSet,
                                            "breach_hours"
                                    );

                            return new CaseInput(
                                    resultSet.getObject(
                                            "id",
                                            UUID.class
                                    ),
                                    resultSet.getString(
                                            "case_number"
                                    ),
                                    resultSet.getString(
                                            "priority"
                                    ),
                                    resultSet.getString(
                                            "status"
                                    ),
                                    createdAt.toInstant(),
                                    targetHours,
                                    elapsedHours,
                                    breachHours,
                                    resultSet.getString(
                                            "sla_state"
                                    )
                            );
                        }
                );

        List<ScoredCase> scoredCases =
                cases
                        .stream()
                        .map(
                                caseInput ->
                                        scoreCase(
                                                caseInput,
                                                calculatedAt
                                        )
                        )
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                (
                                                        ScoredCase item
                                                ) ->
                                                        item
                                                                .score()
                                                                .score()
                                        )
                                        .reversed()
                                        .thenComparing(
                                                item ->
                                                        item
                                                                .input()
                                                                .caseNumber()
                                        )
                        )
                        .toList();

        int urgentCount =
                countBand(
                        scoredCases,
                        "URGENT"
                );

        int highCount =
                countBand(
                        scoredCases,
                        "HIGH"
                );

        int mediumCount =
                countBand(
                        scoredCases,
                        "MEDIUM"
                );

        int routineCount =
                countBand(
                        scoredCases,
                        "ROUTINE"
                );

        jdbcTemplate.update(
                """
                INSERT INTO investigation_triage_runs (
                    id,
                    calculated_by,
                    calculated_at,
                    case_count,
                    urgent_count,
                    high_count,
                    medium_count,
                    routine_count
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
                runId,
                actor,
                Timestamp.from(
                        calculatedAt
                ),
                scoredCases.size(),
                urgentCount,
                highCount,
                mediumCount,
                routineCount
        );

        for (
                ScoredCase item
                        : scoredCases
        ) {
            InvestigationTriageScorer.TriageScore
                    score =
                    item.score();

            CaseInput caseInput =
                    item.input();

            jdbcTemplate.update(
                    """
                    INSERT INTO investigation_triage_snapshots (
                        id,
                        run_id,
                        case_id,
                        case_number,
                        case_priority,
                        case_status,
                        triage_score,
                        triage_band,
                        priority_points,
                        sla_points,
                        age_points,
                        status_points,
                        explanation,
                        calculated_at
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
                        ?
                    )
                    """,
                    UUID.randomUUID(),
                    runId,
                    caseInput.caseId(),
                    caseInput.caseNumber(),
                    caseInput.priority(),
                    caseInput.status(),
                    score.score(),
                    score.band(),
                    score.priorityPoints(),
                    score.slaPoints(),
                    score.agePoints(),
                    score.statusPoints(),
                    score.explanation(),
                    Timestamp.from(
                            calculatedAt
                    )
            );
        }

        return new TriageRunView(
                runId.toString(),
                actor,
                calculatedAt,
                scoredCases.size(),
                urgentCount,
                highCount,
                mediumCount,
                routineCount,
                queueForRun(
                        runId
                )
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<QueueItemView> queue() {
        UUID latestRun =
                jdbcTemplate.query(
                        """
                        SELECT id
                        FROM investigation_triage_runs
                        ORDER BY calculated_at DESC
                        LIMIT 1
                        """,
                        resultSet ->
                                resultSet.next()
                                        ? resultSet.getObject(
                                        "id",
                                        UUID.class
                                )
                                        : null
                );

        if (
                latestRun == null
        ) {
            return List.of();
        }

        return queueForRun(
                latestRun
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<TriageRunSummaryView> history() {
        return jdbcTemplate.query(
                """
                SELECT id,
                       calculated_by,
                       calculated_at,
                       case_count,
                       urgent_count,
                       high_count,
                       medium_count,
                       routine_count
                FROM investigation_triage_runs
                ORDER BY calculated_at DESC
                LIMIT 12
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new TriageRunSummaryView(
                                resultSet.getObject(
                                                "id",
                                                UUID.class
                                        )
                                        .toString(),
                                resultSet.getString(
                                        "calculated_by"
                                ),
                                resultSet.getTimestamp(
                                                "calculated_at"
                                        )
                                        .toInstant(),
                                resultSet.getInt(
                                        "case_count"
                                ),
                                resultSet.getInt(
                                        "urgent_count"
                                ),
                                resultSet.getInt(
                                        "high_count"
                                ),
                                resultSet.getInt(
                                        "medium_count"
                                ),
                                resultSet.getInt(
                                        "routine_count"
                                )
                        )
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public OwnershipView assignOwner(
            UUID caseId,
            String ownerUsername,
            String assignedBy,
            String assignmentNote
    ) {
        if (
                caseId == null
        ) {
            throw new IllegalArgumentException(
                    "caseId is required."
            );
        }

        String owner =
                requireText(
                        ownerUsername,
                        "ownerUsername"
                );

        String actor =
                requireText(
                        assignedBy,
                        "assignedBy"
                );

        String note =
                requireText(
                        assignmentNote,
                        "assignmentNote"
                );

        if (
                owner.length() > 180
        ) {
            throw new IllegalArgumentException(
                    "ownerUsername is too long."
            );
        }

        if (
                note.length() > 1000
        ) {
            throw new IllegalArgumentException(
                    "assignmentNote is too long."
            );
        }

        Integer exists =
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
                exists == null
                        || exists != 1
        ) {
            throw new IllegalArgumentException(
                    "Investigation case not found: "
                            + caseId
            );
        }

        Instant assignedAt =
                Instant.now();

        jdbcTemplate.update(
                """
                INSERT INTO case_queue_ownership (
                    case_id,
                    owner_username,
                    assigned_by,
                    assignment_note,
                    assigned_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?
                )
                ON CONFLICT (case_id)
                DO UPDATE SET
                    owner_username = EXCLUDED.owner_username,
                    assigned_by = EXCLUDED.assigned_by,
                    assignment_note = EXCLUDED.assignment_note,
                    assigned_at = EXCLUDED.assigned_at
                """,
                caseId,
                owner,
                actor,
                note,
                Timestamp.from(
                        assignedAt
                )
        );

        return new OwnershipView(
                caseId.toString(),
                owner,
                actor,
                note,
                assignedAt
        );
    }

    private ScoredCase scoreCase(
            CaseInput caseInput,
            Instant now
    ) {
        long ageHours =
                Math.max(
                        0L,
                        Duration.between(
                                        caseInput.createdAt(),
                                        now
                                )
                                .toHours()
                );

        InvestigationTriageScorer.TriageScore score =
                scorer.score(
                        new InvestigationTriageScorer.TriageInput(
                                caseInput.priority(),
                                caseInput.status(),
                                caseInput.slaState(),
                                caseInput.targetHours(),
                                caseInput.elapsedHours(),
                                ageHours
                        )
                );

        return new ScoredCase(
                caseInput,
                score
        );
    }

    private int countBand(
            List<ScoredCase> cases,
            String band
    ) {
        return (int)
                cases
                        .stream()
                        .filter(
                                item ->
                                        band.equals(
                                                item
                                                        .score()
                                                        .band()
                                        )
                        )
                        .count();
    }

    private List<QueueItemView> queueForRun(
            UUID runId
    ) {
        return jdbcTemplate.query(
                """
                SELECT s.id,
                       s.run_id,
                       s.case_id,
                       s.case_number,
                       s.case_priority,
                       s.case_status,
                       s.triage_score,
                       s.triage_band,
                       s.priority_points,
                       s.sla_points,
                       s.age_points,
                       s.status_points,
                       s.explanation,
                       s.calculated_at,
                       o.owner_username,
                       o.assigned_by,
                       o.assignment_note,
                       o.assigned_at
                FROM investigation_triage_snapshots s
                LEFT JOIN case_queue_ownership o
                  ON o.case_id = s.case_id
                WHERE s.run_id = ?
                ORDER BY
                    s.triage_score DESC,
                    s.case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp assignedAt =
                            resultSet.getTimestamp(
                                    "assigned_at"
                            );

                    return new QueueItemView(
                            resultSet.getObject(
                                            "id",
                                            UUID.class
                                    )
                                    .toString(),
                            resultSet.getObject(
                                            "run_id",
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
                                    "triage_score"
                            ),
                            resultSet.getString(
                                    "triage_band"
                            ),
                            resultSet.getInt(
                                    "priority_points"
                            ),
                            resultSet.getInt(
                                    "sla_points"
                            ),
                            resultSet.getInt(
                                    "age_points"
                            ),
                            resultSet.getInt(
                                    "status_points"
                            ),
                            resultSet.getString(
                                    "explanation"
                            ),
                            resultSet.getTimestamp(
                                            "calculated_at"
                                    )
                                    .toInstant(),
                            resultSet.getString(
                                    "owner_username"
                            ),
                            resultSet.getString(
                                    "assigned_by"
                            ),
                            resultSet.getString(
                                    "assignment_note"
                            ),
                            assignedAt == null
                                    ? null
                                    : assignedAt.toInstant()
                    );
                },
                runId
        );
    }

    private static Integer nullableInteger(
            java.sql.ResultSet resultSet,
            String column
    ) throws java.sql.SQLException {
        int value =
                resultSet.getInt(
                        column
                );

        return resultSet.wasNull()
                ? null
                : value;
    }

    private static Long nullableLong(
            java.sql.ResultSet resultSet,
            String column
    ) throws java.sql.SQLException {
        long value =
                resultSet.getLong(
                        column
                );

        return resultSet.wasNull()
                ? null
                : value;
    }

    private String requireText(
            String value,
            String field
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

        return value.trim();
    }

    private record CaseInput(
            UUID caseId,
            String caseNumber,
            String priority,
            String status,
            Instant createdAt,
            Integer targetHours,
            Long elapsedHours,
            Long breachHours,
            String slaState
    ) {
    }

    private record ScoredCase(
            CaseInput input,
            InvestigationTriageScorer.TriageScore score
    ) {
    }

    public record TriageRunView(
            String id,
            String calculatedBy,
            Instant calculatedAt,
            int caseCount,
            int urgentCount,
            int highCount,
            int mediumCount,
            int routineCount,
            List<QueueItemView> queue
    ) {
    }

    public record TriageRunSummaryView(
            String id,
            String calculatedBy,
            Instant calculatedAt,
            int caseCount,
            int urgentCount,
            int highCount,
            int mediumCount,
            int routineCount
    ) {
    }

    public record QueueItemView(
            String id,
            String runId,
            String caseId,
            String caseNumber,
            String casePriority,
            String caseStatus,
            int triageScore,
            String triageBand,
            int priorityPoints,
            int slaPoints,
            int agePoints,
            int statusPoints,
            String explanation,
            Instant calculatedAt,
            String ownerUsername,
            String assignedBy,
            String assignmentNote,
            Instant assignedAt
    ) {
    }

    public record OwnershipView(
            String caseId,
            String ownerUsername,
            String assignedBy,
            String assignmentNote,
            Instant assignedAt
    ) {
    }
}
