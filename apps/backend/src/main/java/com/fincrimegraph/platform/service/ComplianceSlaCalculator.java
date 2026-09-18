package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;

@Component
public class ComplianceSlaCalculator {

    public SlaResult evaluate(
            String caseStatus,
            Instant createdAt,
            Instant closedAt,
            int targetHours,
            Instant now
    ) {
        if (
                createdAt == null
        ) {
            throw new IllegalArgumentException(
                    "createdAt is required."
            );
        }

        if (
                now == null
        ) {
            throw new IllegalArgumentException(
                    "now is required."
            );
        }

        if (
                targetHours <= 0
        ) {
            throw new IllegalArgumentException(
                    "targetHours must be positive."
            );
        }

        String normalizedStatus =
                caseStatus == null
                        ? "OPEN"
                        : caseStatus
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        boolean closed =
                "CLOSED".equals(
                        normalizedStatus
                );

        Instant effectiveEnd =
                closed
                        && closedAt != null
                        ? closedAt
                        : now;

        if (
                effectiveEnd.isBefore(
                        createdAt
                )
        ) {
            effectiveEnd =
                    createdAt;
        }

        long elapsedHours =
                Duration.between(
                        createdAt,
                        effectiveEnd
                )
                        .toHours();

        long breachHours =
                Math.max(
                        0L,
                        elapsedHours
                                - targetHours
                );

        String state;

        if (closed) {
            state =
                    breachHours > 0
                            ? "CLOSED_BREACHED"
                            : "CLOSED_WITHIN_SLA";

        } else {
            state =
                    breachHours > 0
                            ? "BREACHED"
                            : "WITHIN_SLA";
        }

        return new SlaResult(
                targetHours,
                elapsedHours,
                breachHours,
                state
        );
    }

    public record SlaResult(
            int targetHours,
            long elapsedHours,
            long breachHours,
            String state
    ) {
    }
}
