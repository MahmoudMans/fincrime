package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class ComplianceSlaCalculatorTest {

    private final ComplianceSlaCalculator calculator =
            new ComplianceSlaCalculator();

    private final Instant now =
            Instant.parse(
                    "2026-09-18T18:00:00Z"
            );

    @Test
    void detectsOpenSlaBreach() {

        ComplianceSlaCalculator.SlaResult result =
                calculator.evaluate(
                        "OPEN",
                        Instant.parse(
                                "2026-09-18T08:00:00Z"
                        ),
                        null,
                        4,
                        now
                );

        assertThat(
                result.elapsedHours()
        ).isEqualTo(
                10
        );

        assertThat(
                result.breachHours()
        ).isEqualTo(
                6
        );

        assertThat(
                result.state()
        ).isEqualTo(
                "BREACHED"
        );
    }

    @Test
    void detectsOpenCaseWithinSla() {

        ComplianceSlaCalculator.SlaResult result =
                calculator.evaluate(
                        "IN_REVIEW",
                        Instant.parse(
                                "2026-09-18T14:00:00Z"
                        ),
                        null,
                        12,
                        now
                );

        assertThat(
                result.elapsedHours()
        ).isEqualTo(
                4
        );

        assertThat(
                result.breachHours()
        ).isZero();

        assertThat(
                result.state()
        ).isEqualTo(
                "WITHIN_SLA"
        );
    }

    @Test
    void usesClosedTimestampForClosedCase() {

        ComplianceSlaCalculator.SlaResult result =
                calculator.evaluate(
                        "CLOSED",
                        Instant.parse(
                                "2026-09-18T08:00:00Z"
                        ),
                        Instant.parse(
                                "2026-09-18T10:00:00Z"
                        ),
                        4,
                        now
                );

        assertThat(
                result.elapsedHours()
        ).isEqualTo(
                2
        );

        assertThat(
                result.breachHours()
        ).isZero();

        assertThat(
                result.state()
        ).isEqualTo(
                "CLOSED_WITHIN_SLA"
        );
    }

    @Test
    void preservesClosedBreach() {

        ComplianceSlaCalculator.SlaResult result =
                calculator.evaluate(
                        "CLOSED",
                        Instant.parse(
                                "2026-09-18T06:00:00Z"
                        ),
                        Instant.parse(
                                "2026-09-18T13:00:00Z"
                        ),
                        4,
                        now
                );

        assertThat(
                result.elapsedHours()
        ).isEqualTo(
                7
        );

        assertThat(
                result.breachHours()
        ).isEqualTo(
                3
        );

        assertThat(
                result.state()
        ).isEqualTo(
                "CLOSED_BREACHED"
        );
    }
}
