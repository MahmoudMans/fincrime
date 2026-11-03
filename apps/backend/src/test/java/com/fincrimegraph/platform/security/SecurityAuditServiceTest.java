package com.fincrimegraph.platform.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SecurityAuditServiceTest {

    @Test
    void blankTextGetsTheFallback() {
        assertThat(SecurityAuditService.safe(null, "anonymous", 180))
                .isEqualTo("anonymous");

        assertThat(SecurityAuditService.safe("   ", "UNKNOWN", 80))
                .isEqualTo("UNKNOWN");
    }

    @Test
    void textThatFitsIsKeptAsItIs() {
        assertThat(
                SecurityAuditService.safe(
                        "analyst@fincrime.local",
                        "anonymous",
                        180
                )
        ).isEqualTo("analyst@fincrime.local");
    }

    @Test
    void longTextIsCutToTheColumnWidth() {
        String attackerChosenName = "a".repeat(500);

        String stored =
                SecurityAuditService.safe(
                        attackerChosenName,
                        "anonymous",
                        180
                );

        assertThat(stored.length()).isEqualTo(180);
    }

    @Test
    void clipKeepsMissingValuesMissing() {
        assertThat(SecurityAuditService.clip(null, 180)).isNull();
    }

    @Test
    void clipCutsOnlyWhatDoesNotFit() {
        assertThat(SecurityAuditService.clip("abcdef", 4))
                .isEqualTo("abcd");

        assertThat(SecurityAuditService.clip("abcd", 4))
                .isEqualTo("abcd");
    }
}
