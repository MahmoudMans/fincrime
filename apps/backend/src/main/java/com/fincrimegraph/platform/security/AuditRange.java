package com.fincrimegraph.platform.security;

import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * A validated request for one page of security audit events inside a
 * time range. Missing ends of the range are left open, and the page
 * size is kept between 1 and {@value #MAX_SIZE}.
 */
public record AuditRange(
        Instant from,
        Instant to,
        int page,
        int size
) {

    public static final int DEFAULT_SIZE = 200;

    public static final int MAX_SIZE = 500;

    public static AuditRange of(
            String from,
            String to,
            Integer page,
            Integer size,
            Instant now
    ) {
        Instant start =
                parse(
                        from,
                        "from",
                        Instant.EPOCH
                );

        Instant end =
                parse(
                        to,
                        "to",
                        now.plus(Duration.ofDays(1))
                );

        if (start.isAfter(end)) {
            throw new IllegalArgumentException(
                    "The start of the range is after its end."
            );
        }

        int safePage =
                page == null || page < 0
                        ? 0
                        : Math.min(page, 100_000);

        int safeSize =
                size == null || size < 1
                        ? DEFAULT_SIZE
                        : Math.min(size, MAX_SIZE);

        return new AuditRange(
                start,
                end,
                safePage,
                safeSize
        );
    }

    private static Instant parse(
            String value,
            String field,
            Instant fallback
    ) {
        if (value == null || value.isBlank()) {
            return fallback;
        }

        try {
            return Instant.parse(value.trim());
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException(
                    field
                            + " must be an ISO-8601 time such as 2026-01-31T00:00:00Z."
            );
        }
    }
}
