package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.InvestigationCaseEntity;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class InvestigationCaseEntityTest {

    @Test
    void advancesCaseThroughInvestigationLifecycle() {
        AlertEntity alert =
                new AlertEntity(
                        UUID.randomUUID(),
                        "TEST-ALERT",
                        AlertEntity.AlertType.CIRCULAR_FLOW,
                        AlertEntity.AlertSeverity.CRITICAL,
                        95,
                        AlertEntity.AlertStatus.OPEN,
                        "Test alert",
                        "Test description",
                        null,
                        null,
                        Instant.now()
                );

        InvestigationCaseEntity investigationCase =
                new InvestigationCaseEntity(
                        UUID.randomUUID(),
                        "CASE-TEST",
                        "Test case",
                        InvestigationCaseEntity.CaseStatus.OPEN,
                        InvestigationCaseEntity.CasePriority.CRITICAL,
                        "Investigation summary",
                        null,
                        alert,
                        Instant.now(),
                        Instant.now()
                );

        investigationCase.advance(Instant.now());

        assertThat(investigationCase.getStatus())
                .isEqualTo(
                        InvestigationCaseEntity
                                .CaseStatus
                                .IN_REVIEW
                );

        investigationCase.advance(Instant.now());

        assertThat(investigationCase.getStatus())
                .isEqualTo(
                        InvestigationCaseEntity
                                .CaseStatus
                                .CLOSED
                );

        investigationCase.advance(Instant.now());

        assertThat(investigationCase.getStatus())
                .isEqualTo(
                        InvestigationCaseEntity
                                .CaseStatus
                                .CLOSED
                );
    }
}
