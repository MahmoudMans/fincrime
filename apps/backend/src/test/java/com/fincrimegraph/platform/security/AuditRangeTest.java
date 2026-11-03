package com.fincrimegraph.platform.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuditRangeTest {

    private static final Instant NOW =
            Instant.parse("2026-06-15T12:00:00Z");

    @Test
    void withoutLimitsCoversEverythingUpToTomorrow() {
        AuditRange range =
                AuditRange.of(null, null, null, null, NOW);

        assertThat(range.from()).isEqualTo(Instant.EPOCH);
        assertThat(range.to()).isEqualTo(NOW.plus(Duration.ofDays(1)));
        assertThat(range.page()).isEqualTo(0);
        assertThat(range.size()).isEqualTo(AuditRange.DEFAULT_SIZE);
    }

    @Test
    void readsBothEndsAsIsoInstants() {
        AuditRange range =
                AuditRange.of(
                        "2026-03-01T00:00:00.000Z",
                        " 2026-03-31T23:59:59.999Z ",
                        null,
                        null,
                        NOW
                );

        assertThat(range.from())
                .isEqualTo(Instant.parse("2026-03-01T00:00:00Z"));

        assertThat(range.to())
                .isEqualTo(Instant.parse("2026-03-31T23:59:59.999Z"));
    }

    @Test
    void blankValuesLeaveTheEndOpen() {
        AuditRange range =
                AuditRange.of("  ", "", null, null, NOW);

        assertThat(range.from()).isEqualTo(Instant.EPOCH);
        assertThat(range.to()).isEqualTo(NOW.plus(Duration.ofDays(1)));
    }

    @Test
    void rejectsAStartThatIsNotATime() {
        assertThatThrownBy(
                () -> AuditRange.of("yesterday", null, null, null, NOW)
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("from must be an ISO-8601 time");
    }

    @Test
    void rejectsAnEndThatIsNotATime() {
        assertThatThrownBy(
                () -> AuditRange.of(null, "2026-13-45", null, null, NOW)
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("to must be an ISO-8601 time");
    }

    @Test
    void rejectsAStartAfterTheEnd() {
        assertThatThrownBy(
                () -> AuditRange.of(
                        "2026-05-02T00:00:00Z",
                        "2026-05-01T00:00:00Z",
                        null,
                        null,
                        NOW
                )
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("after its end");
    }

    @Test
    void keepsThePageSizeWithinLimits() {
        assertThat(size(0)).isEqualTo(AuditRange.DEFAULT_SIZE);
        assertThat(size(-5)).isEqualTo(AuditRange.DEFAULT_SIZE);
        assertThat(size(25)).isEqualTo(25);
        assertThat(size(10_000)).isEqualTo(AuditRange.MAX_SIZE);
    }

    @Test
    void keepsThePageNumberUsable() {
        assertThat(
                AuditRange.of(null, null, -3, null, NOW).page()
        ).isEqualTo(0);

        assertThat(
                AuditRange.of(null, null, 4, null, NOW).page()
        ).isEqualTo(4);

        assertThat(
                AuditRange.of(null, null, Integer.MAX_VALUE, null, NOW)
                        .page()
        ).isEqualTo(100_000);
    }

    private static int size(int requested) {
        return AuditRange.of(null, null, null, requested, NOW).size();
    }
}
