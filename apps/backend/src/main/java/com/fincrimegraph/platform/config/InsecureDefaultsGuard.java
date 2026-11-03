package com.fincrimegraph.platform.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * The repository ships with development credentials and a development
 * JWT signing secret so the project runs with zero configuration.
 * Those values are public, so they must never reach a real
 * environment.
 *
 * Outside the "prod" / "production" profiles this only logs a loud
 * warning. With either of those profiles active, the application
 * refuses to start while any default is still in use.
 */
@Component
public class InsecureDefaultsGuard {

    private static final Logger log =
            LoggerFactory.getLogger(
                    InsecureDefaultsGuard.class
            );

    static final String DEFAULT_JWT_SECRET =
            "fincrime-graph-local-development-jwt-secret-"
                    + "2026-change-me-before-production";

    static final String DEFAULT_ANALYST_PASSWORD =
            "FinCrime!Analyst2026";

    static final String DEFAULT_SENIOR_PASSWORD =
            "FinCrime!Senior2026";

    static final String DEFAULT_ADMIN_PASSWORD =
            "FinCrime!Admin2026";

    public InsecureDefaultsGuard(
            Environment environment,

            @Value("${app.security.jwt-secret}")
            String jwtSecret,

            @Value("${app.security.analyst-password}")
            String analystPassword,

            @Value("${app.security.senior-password}")
            String seniorPassword,

            @Value("${app.security.admin-password}")
            String adminPassword
    ) {
        List<String> findings =
                findInsecureDefaults(
                        jwtSecret,
                        analystPassword,
                        seniorPassword,
                        adminPassword
                );

        if (findings.isEmpty()) {
            return;
        }

        String message =
                "Development defaults are still in use: "
                        + String.join(", ", findings)
                        + ". Set JWT_SECRET and the "
                        + "FINCRIME_*_PASSWORD variables before "
                        + "exposing this service.";

        boolean production =
                environment.acceptsProfiles(
                        Profiles.of("prod", "production")
                );

        if (production) {
            throw new IllegalStateException(message);
        }

        log.warn(message);
    }

    static List<String> findInsecureDefaults(
            String jwtSecret,
            String analystPassword,
            String seniorPassword,
            String adminPassword
    ) {
        List<String> findings =
                new ArrayList<>();

        if (DEFAULT_JWT_SECRET.equals(jwtSecret)) {
            findings.add("JWT signing secret");
        }

        if (DEFAULT_ANALYST_PASSWORD.equals(analystPassword)) {
            findings.add("analyst password");
        }

        if (DEFAULT_SENIOR_PASSWORD.equals(seniorPassword)) {
            findings.add("senior analyst password");
        }

        if (DEFAULT_ADMIN_PASSWORD.equals(adminPassword)) {
            findings.add("administrator password");
        }

        return findings;
    }
}
