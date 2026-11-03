package com.fincrimegraph.platform.security;

import java.time.Duration;

/**
 * Thrown instead of checking the password when a user name is locked
 * after repeated failed sign-ins.
 */
public class LoginThrottledException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final long retryAfterSeconds;

    public LoginThrottledException(Duration wait) {
        super("Too many failed sign-in attempts.");

        this.retryAfterSeconds =
                Math.max(
                        1L,
                        (wait.toMillis() + 999L) / 1000L
                );
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
