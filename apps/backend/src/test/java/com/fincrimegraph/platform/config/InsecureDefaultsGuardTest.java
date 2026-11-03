package com.fincrimegraph.platform.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

class InsecureDefaultsGuardTest {

    @Test
    void reportsEveryDevelopmentDefaultStillInUse() {
        var findings =
                InsecureDefaultsGuard.findInsecureDefaults(
                        InsecureDefaultsGuard.DEFAULT_JWT_SECRET,
                        InsecureDefaultsGuard.DEFAULT_ANALYST_PASSWORD,
                        "custom-senior-password",
                        InsecureDefaultsGuard.DEFAULT_ADMIN_PASSWORD
                );

        assertThat(findings)
                .containsExactly(
                        "JWT signing secret",
                        "analyst password",
                        "administrator password"
                );
    }

    @Test
    void reportsNothingWhenEverythingIsOverridden() {
        assertThat(
                InsecureDefaultsGuard.findInsecureDefaults(
                        "a-real-secret-of-sufficient-length-123456",
                        "analyst-secret",
                        "senior-secret",
                        "admin-secret"
                )
        ).isEmpty();
    }

    @Test
    void failsStartupInProductionWhenDefaultsRemain() {
        MockEnvironment environment =
                new MockEnvironment();

        environment.setActiveProfiles("prod");

        assertThatThrownBy(() ->
                new InsecureDefaultsGuard(
                        environment,
                        InsecureDefaultsGuard.DEFAULT_JWT_SECRET,
                        "analyst-secret",
                        "senior-secret",
                        "admin-secret"
                )
        )
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("JWT signing secret");
    }

    @Test
    void onlyWarnsOutsideProduction() {
        MockEnvironment environment =
                new MockEnvironment();

        assertThatCode(() ->
                new InsecureDefaultsGuard(
                        environment,
                        InsecureDefaultsGuard.DEFAULT_JWT_SECRET,
                        InsecureDefaultsGuard.DEFAULT_ANALYST_PASSWORD,
                        InsecureDefaultsGuard.DEFAULT_SENIOR_PASSWORD,
                        InsecureDefaultsGuard.DEFAULT_ADMIN_PASSWORD
                )
        ).doesNotThrowAnyException();
    }
}
