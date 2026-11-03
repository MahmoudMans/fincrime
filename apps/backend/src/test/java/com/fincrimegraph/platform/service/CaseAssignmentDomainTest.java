package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.InvestigationCaseEntity;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class CaseAssignmentDomainTest {

    @Test
    void aCaseCanBeAssignedAndThenReleased() {
        Instant created = Instant.parse("2026-02-01T10:00:00Z");
        Instant assigned = Instant.parse("2026-02-01T11:00:00Z");
        Instant released = Instant.parse("2026-02-01T12:00:00Z");

        InvestigationCaseEntity investigationCase = newCase(created);

        assertThat(investigationCase.getAssignedTo()).isNull();

        investigationCase.assignTo(
                "Senior AML Analyst (senior@fincrime.local)",
                assigned
        );

        assertThat(investigationCase.getAssignedTo())
                .isEqualTo("Senior AML Analyst (senior@fincrime.local)");

        investigationCase.assignTo(null, released);

        assertThat(investigationCase.getAssignedTo()).isNull();
        assertThat(investigationCase.getUpdatedAt()).isEqualTo(released);
    }

    private static InvestigationCaseEntity newCase(Instant now) {
        AlertEntity alert =
                new AlertEntity(
                        UUID.randomUUID(),
                        "TEST-ALERT",
                        AlertEntity.AlertType.CIRCULAR_FLOW,
                        AlertEntity.AlertSeverity.HIGH,
                        80,
                        AlertEntity.AlertStatus.OPEN,
                        "Test alert",
                        "Test description",
                        null,
                        null,
                        now
                );

        return new InvestigationCaseEntity(
                UUID.randomUUID(),
                "CASE-ASSIGN",
                "Assignment test",
                InvestigationCaseEntity.CaseStatus.OPEN,
                InvestigationCaseEntity.CasePriority.HIGH,
                "Investigation summary",
                null,
                alert,
                now,
                now
        );
    }
}
