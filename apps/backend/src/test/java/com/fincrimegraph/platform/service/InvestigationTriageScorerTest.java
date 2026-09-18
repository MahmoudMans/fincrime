package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class InvestigationTriageScorerTest {

    private final InvestigationTriageScorer scorer =
            new InvestigationTriageScorer();

    @Test
    void producesUrgentScoreForCriticalBreachedCase() {

        InvestigationTriageScorer.TriageScore result =
                scorer.score(
                        new InvestigationTriageScorer.TriageInput(
                                "CRITICAL",
                                "OPEN",
                                "BREACHED",
                                4,
                                12L,
                                96L
                        )
                );

        assertThat(
                result.score()
        ).isEqualTo(
                100
        );

        assertThat(
                result.band()
        ).isEqualTo(
                "URGENT"
        );

        assertThat(
                result.priorityPoints()
        ).isEqualTo(
                40
        );

        assertThat(
                result.slaPoints()
        ).isEqualTo(
                35
        );

        assertThat(
                result.agePoints()
        ).isEqualTo(
                15
        );

        assertThat(
                result.statusPoints()
        ).isEqualTo(
                10
        );
    }

    @Test
    void closedWithinSlaCaseHasNoAgeOrStatusPressure() {

        InvestigationTriageScorer.TriageScore result =
                scorer.score(
                        new InvestigationTriageScorer.TriageInput(
                                "MEDIUM",
                                "CLOSED",
                                "CLOSED_WITHIN_SLA",
                                24,
                                2L,
                                240L
                        )
                );

        assertThat(
                result.score()
        ).isEqualTo(
                20
        );

        assertThat(
                result.band()
        ).isEqualTo(
                "ROUTINE"
        );

        assertThat(
                result.slaPoints()
        ).isZero();

        assertThat(
                result.agePoints()
        ).isZero();

        assertThat(
                result.statusPoints()
        ).isZero();
    }

    @Test
    void withinSlaPressureIncreasesNearDeadline() {

        InvestigationTriageScorer.TriageScore early =
                scorer.score(
                        new InvestigationTriageScorer.TriageInput(
                                "HIGH",
                                "IN_REVIEW",
                                "WITHIN_SLA",
                                12,
                                2L,
                                4L
                        )
                );

        InvestigationTriageScorer.TriageScore late =
                scorer.score(
                        new InvestigationTriageScorer.TriageInput(
                                "HIGH",
                                "IN_REVIEW",
                                "WITHIN_SLA",
                                12,
                                10L,
                                10L
                        )
                );

        assertThat(
                late.slaPoints()
        ).isGreaterThan(
                early.slaPoints()
        );

        assertThat(
                late.score()
        ).isGreaterThan(
                early.score()
        );
    }
}
