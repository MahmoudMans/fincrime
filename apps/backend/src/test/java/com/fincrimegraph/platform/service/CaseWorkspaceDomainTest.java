package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.InvestigationCaseEntity;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CaseWorkspaceDomainTest {

    @Test
    void supportsAssignmentAndResolution() {

        AlertEntity alert =
                new AlertEntity(
                        UUID.randomUUID(),
                        "CASE-WORKSPACE-ALERT",
                        AlertEntity.AlertType.CIRCULAR_FLOW,
                        AlertEntity.AlertSeverity.CRITICAL,
                        96,
                        AlertEntity.AlertStatus.OPEN,
                        "Circular money flow",
                        "Test evidence",
                        null,
                        null,
                        Instant.now()
                );

        Instant createdAt =
                Instant.parse(
                        "2026-09-18T10:00:00Z"
                );

        InvestigationCaseEntity investigationCase =
                new InvestigationCaseEntity(
                        UUID.randomUUID(),
                        "CASE-TEST-001",
                        "Circular flow investigation",
                        InvestigationCaseEntity.CaseStatus.OPEN,
                        InvestigationCaseEntity.CasePriority.CRITICAL,
                        "Investigate transaction network.",
                        null,
                        alert,
                        createdAt,
                        createdAt
                );

        Instant assignedAt =
                createdAt.plusSeconds(60);

        investigationCase.assignTo(
                "Senior AML Analyst",
                assignedAt
        );

        assertThat(
                investigationCase.getAssignedTo()
        ).isEqualTo(
                "Senior AML Analyst"
        );

        Instant resolvedAt =
                createdAt.plusSeconds(120);

        investigationCase.resolve(
                InvestigationCaseEntity
                        .CaseDisposition
                        .ESCALATED,
                "Escalated for enhanced review.",
                resolvedAt
        );

        assertThat(
                investigationCase.getStatus()
        ).isEqualTo(
                InvestigationCaseEntity
                        .CaseStatus
                        .CLOSED
        );

        assertThat(
                investigationCase.getDisposition()
        ).isEqualTo(
                InvestigationCaseEntity
                        .CaseDisposition
                        .ESCALATED
        );

        assertThat(
                investigationCase
                        .getResolutionSummary()
        ).isEqualTo(
                "Escalated for enhanced review."
        );

        assertThat(
                investigationCase.getClosedAt()
        ).isEqualTo(
                resolvedAt
        );
    }
}
