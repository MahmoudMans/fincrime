package com.fincrimegraph.platform.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ComplianceOperationsService {

    private final JdbcTemplate jdbcTemplate;
    private final ComplianceSlaCalculator slaCalculator;

    public ComplianceOperationsService(
            JdbcTemplate jdbcTemplate,
            ComplianceSlaCalculator slaCalculator
    ) {
        this.jdbcTemplate =
                jdbcTemplate;

        this.slaCalculator =
                slaCalculator;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public ComplianceOverviewView overview() {

        long totalAlerts =
                count(
                        """
                        SELECT COUNT(*)
                        FROM alerts
                        """
                );

        long activeAlerts =
                count(
                        """
                        SELECT COUNT(*)
                        FROM alerts
                        WHERE status <> 'CLOSED'
                        """
                );

        long totalCases =
                count(
                        """
                        SELECT COUNT(*)
                        FROM investigation_cases
                        """
                );

        long openCases =
                count(
                        """
                        SELECT COUNT(*)
                        FROM investigation_cases
                        WHERE status <> 'CLOSED'
                        """
                );

        long pendingWatchlistHits =
                count(
                        """
                        SELECT COUNT(*)
                        FROM screening_hits
                        WHERE status = 'PENDING_REVIEW'
                        """
                );

        long enabledAmlRules =
                count(
                        """
                        SELECT COUNT(*)
                        FROM detection_rules
                        WHERE enabled = TRUE
                        """
                );

        long criticalRiskCustomers =
                count(
                        """
                        SELECT COUNT(*)
                        FROM (
                            SELECT DISTINCT ON (customer_id)
                                   customer_id,
                                   risk_band
                            FROM customer_risk_assessments
                            ORDER BY
                                customer_id,
                                generated_at DESC
                        ) latest
                        WHERE latest.risk_band = 'CRITICAL'
                        """
                );

        long highRiskCustomers =
                count(
                        """
                        SELECT COUNT(*)
                        FROM (
                            SELECT DISTINCT ON (customer_id)
                                   customer_id,
                                   risk_band
                            FROM customer_risk_assessments
                            ORDER BY
                                customer_id,
                                generated_at DESC
                        ) latest
                        WHERE latest.risk_band = 'HIGH'
                        """
                );

        long slaBreaches =
                count(
                        """
                        SELECT COUNT(*)
                        FROM case_sla_status
                        WHERE sla_state IN (
                            'BREACHED',
                            'CLOSED_BREACHED'
                        )
                        """
                );

        long reportsExported =
                count(
                        """
                        SELECT COUNT(*)
                        FROM security_audit_events
                        WHERE action = 'CASE_REPORT_EXPORT'
                        """
                );

        return new ComplianceOverviewView(
                totalAlerts,
                activeAlerts,
                totalCases,
                openCases,
                pendingWatchlistHits,
                enabledAmlRules,
                criticalRiskCustomers,
                highRiskCustomers,
                slaBreaches,
                reportsExported,
                groupedCounts(
                        """
                        SELECT severity AS key,
                               COUNT(*) AS value
                        FROM alerts
                        GROUP BY severity
                        ORDER BY severity
                        """
                ),
                groupedCounts(
                        """
                        SELECT priority AS key,
                               COUNT(*) AS value
                        FROM investigation_cases
                        GROUP BY priority
                        ORDER BY priority
                        """
                ),
                groupedCounts(
                        """
                        SELECT risk_band AS key,
                               COUNT(*) AS value
                        FROM (
                            SELECT DISTINCT ON (customer_id)
                                   customer_id,
                                   risk_band
                            FROM customer_risk_assessments
                            ORDER BY
                                customer_id,
                                generated_at DESC
                        ) latest
                        GROUP BY risk_band
                        ORDER BY risk_band
                        """
                ),
                groupedCounts(
                        """
                        SELECT status AS key,
                               COUNT(*) AS value
                        FROM screening_hits
                        GROUP BY status
                        ORDER BY status
                        """
                )
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public SlaRecalculationView recalculateSla() {

        Map<String, Integer> policies =
                new LinkedHashMap<>();

        jdbcTemplate.query(
                """
                SELECT priority,
                       target_hours
                FROM compliance_sla_policies
                WHERE active = TRUE
                ORDER BY priority
                """,
                resultSet -> {
                    policies.put(
                            resultSet.getString(
                                    "priority"
                            ),
                            resultSet.getInt(
                                    "target_hours"
                            )
                    );
                }
        );

        if (
                policies.isEmpty()
        ) {
            throw new IllegalStateException(
                    "No active SLA policies are configured."
            );
        }

        List<CaseSnapshot> cases =
                jdbcTemplate.query(
                        """
                        SELECT id,
                               case_number,
                               priority,
                               status,
                               created_at,
                               closed_at
                        FROM investigation_cases
                        ORDER BY
                            created_at,
                            case_number
                        """,
                        (
                                resultSet,
                                rowNumber
                        ) ->
                                new CaseSnapshot(
                                        resultSet
                                                .getObject(
                                                        "id",
                                                        UUID.class
                                                ),
                                        resultSet
                                                .getString(
                                                        "case_number"
                                                ),
                                        resultSet
                                                .getString(
                                                        "priority"
                                                ),
                                        resultSet
                                                .getString(
                                                        "status"
                                                ),
                                        resultSet
                                                .getTimestamp(
                                                        "created_at"
                                                )
                                                .toInstant(),
                                        nullableInstant(
                                                resultSet
                                                        .getTimestamp(
                                                                "closed_at"
                                                        )
                                        )
                                )
                );

        Instant calculatedAt =
                Instant.now();

        int breachCount =
                0;

        int withinSlaCount =
                0;

        int closedCount =
                0;

        for (
                CaseSnapshot caseSnapshot
                        : cases
        ) {
            Integer targetHours =
                    policies.get(
                            caseSnapshot
                                    .priority()
                    );

            if (
                    targetHours == null
            ) {
                throw new IllegalStateException(
                        "No SLA policy for case priority "
                                + caseSnapshot
                                .priority()
                );
            }

            ComplianceSlaCalculator.SlaResult
                    result =
                    slaCalculator.evaluate(
                            caseSnapshot
                                    .status(),
                            caseSnapshot
                                    .createdAt(),
                            caseSnapshot
                                    .closedAt(),
                            targetHours,
                            calculatedAt
                    );

            if (
                    result.state()
                            .contains(
                                    "BREACHED"
                            )
            ) {
                breachCount++;

            } else {
                withinSlaCount++;
            }

            if (
                    result.state()
                            .startsWith(
                                    "CLOSED_"
                            )
            ) {
                closedCount++;
            }

            jdbcTemplate.update(
                    """
                    INSERT INTO case_sla_status (
                        id,
                        case_id,
                        case_number,
                        priority,
                        case_status,
                        target_hours,
                        elapsed_hours,
                        breach_hours,
                        sla_state,
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
                        ?
                    )
                    ON CONFLICT (case_id)
                    DO UPDATE SET
                        case_number = EXCLUDED.case_number,
                        priority = EXCLUDED.priority,
                        case_status = EXCLUDED.case_status,
                        target_hours = EXCLUDED.target_hours,
                        elapsed_hours = EXCLUDED.elapsed_hours,
                        breach_hours = EXCLUDED.breach_hours,
                        sla_state = EXCLUDED.sla_state,
                        calculated_at = EXCLUDED.calculated_at
                    """,
                    UUID.randomUUID(),
                    caseSnapshot.id(),
                    caseSnapshot.caseNumber(),
                    caseSnapshot.priority(),
                    caseSnapshot.status(),
                    result.targetHours(),
                    result.elapsedHours(),
                    result.breachHours(),
                    result.state(),
                    Timestamp.from(
                            calculatedAt
                    )
            );
        }

        return new SlaRecalculationView(
                calculatedAt,
                cases.size(),
                withinSlaCount,
                breachCount,
                closedCount
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<SlaPolicyView> policies() {
        return jdbcTemplate.query(
                """
                SELECT priority,
                       target_hours,
                       active,
                       description,
                       updated_at
                FROM compliance_sla_policies
                ORDER BY CASE priority
                    WHEN 'CRITICAL' THEN 1
                    WHEN 'HIGH' THEN 2
                    WHEN 'MEDIUM' THEN 3
                    WHEN 'LOW' THEN 4
                    ELSE 5
                END
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SlaPolicyView(
                                resultSet
                                        .getString(
                                                "priority"
                                        ),
                                resultSet
                                        .getInt(
                                                "target_hours"
                                        ),
                                resultSet
                                        .getBoolean(
                                                "active"
                                        ),
                                resultSet
                                        .getString(
                                                "description"
                                        ),
                                resultSet
                                        .getTimestamp(
                                                "updated_at"
                                        )
                                        .toInstant()
                        )
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<CaseSlaView> caseSla() {
        return jdbcTemplate.query(
                """
                SELECT id,
                       case_id,
                       case_number,
                       priority,
                       case_status,
                       target_hours,
                       elapsed_hours,
                       breach_hours,
                       sla_state,
                       calculated_at
                FROM case_sla_status
                ORDER BY
                    CASE
                        WHEN sla_state = 'BREACHED'
                            THEN 1
                        WHEN sla_state = 'CLOSED_BREACHED'
                            THEN 2
                        WHEN sla_state = 'WITHIN_SLA'
                            THEN 3
                        ELSE 4
                    END,
                    breach_hours DESC,
                    case_number
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CaseSlaView(
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
                                                "priority"
                                        ),
                                resultSet
                                        .getString(
                                                "case_status"
                                        ),
                                resultSet
                                        .getInt(
                                                "target_hours"
                                        ),
                                resultSet
                                        .getLong(
                                                "elapsed_hours"
                                        ),
                                resultSet
                                        .getLong(
                                                "breach_hours"
                                        ),
                                resultSet
                                        .getString(
                                                "sla_state"
                                        ),
                                resultSet
                                        .getTimestamp(
                                                "calculated_at"
                                        )
                                        .toInstant()
                        )
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<AuditActivityView> activity() {
        return jdbcTemplate.query(
                """
                SELECT id,
                       username,
                       action,
                       resource_type,
                       resource_id,
                       outcome,
                       occurred_at AS created_at
                FROM security_audit_events
                ORDER BY occurred_at DESC
                LIMIT 12
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new AuditActivityView(
                                resultSet
                                        .getObject(
                                                "id",
                                                UUID.class
                                        )
                                        .toString(),
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
                                        .getTimestamp(
                                                "created_at"
                                        )
                                        .toInstant()
                        )
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

    private Map<String, Long> groupedCounts(
            String sql
    ) {
        Map<String, Long> result =
                new LinkedHashMap<>();

        jdbcTemplate.query(
                sql,
                resultSet -> {
                    String key =
                            resultSet
                                    .getString(
                                            "key"
                                    );

                    long value =
                            resultSet
                                    .getLong(
                                            "value"
                                    );

                    result.put(
                            key,
                            value
                    );
                }
        );

        return result;
    }

    private static Instant nullableInstant(
            Timestamp value
    ) {
        return value == null
                ? null
                : value.toInstant();
    }

    private record CaseSnapshot(
            UUID id,
            String caseNumber,
            String priority,
            String status,
            Instant createdAt,
            Instant closedAt
    ) {
    }

    public record ComplianceOverviewView(
            long totalAlerts,
            long activeAlerts,
            long totalCases,
            long openCases,
            long pendingWatchlistHits,
            long enabledAmlRules,
            long criticalRiskCustomers,
            long highRiskCustomers,
            long slaBreaches,
            long reportsExported,
            Map<String, Long> alertSeverityDistribution,
            Map<String, Long> casePriorityDistribution,
            Map<String, Long> riskBandDistribution,
            Map<String, Long> watchlistStatusDistribution
    ) {
    }

    public record SlaRecalculationView(
            Instant calculatedAt,
            int casesEvaluated,
            int withinSlaCount,
            int breachCount,
            int closedCount
    ) {
    }

    public record SlaPolicyView(
            String priority,
            int targetHours,
            boolean active,
            String description,
            Instant updatedAt
    ) {
    }

    public record CaseSlaView(
            String id,
            String caseId,
            String caseNumber,
            String priority,
            String caseStatus,
            int targetHours,
            long elapsedHours,
            long breachHours,
            String slaState,
            Instant calculatedAt
    ) {
    }

    public record AuditActivityView(
            String id,
            String username,
            String action,
            String resourceType,
            String resourceId,
            String outcome,
            Instant createdAt
    ) {
    }
}
