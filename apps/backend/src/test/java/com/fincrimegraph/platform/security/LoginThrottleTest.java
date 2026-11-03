package com.fincrimegraph.platform.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class LoginThrottleTest {

    private static final String USER = "analyst@fincrime.local";

    private final MutableClock clock =
            new MutableClock(
                    Instant.parse("2026-01-01T09:00:00Z")
            );

    private final LoginThrottle throttle =
            new LoginThrottle(clock);

    @Test
    void allowsAttemptsUntilTheLimitIsReached() {
        for (int i = 1; i < LoginThrottle.MAX_FAILURES; i++) {
            assertThat(throttle.recordFailure(USER)).isFalse();
            assertThat(throttle.remainingLock(USER).isZero()).isTrue();
        }
    }

    @Test
    void locksOnTheFailureThatReachesTheLimit() {
        failTimes(USER, LoginThrottle.MAX_FAILURES - 1);

        assertThat(throttle.recordFailure(USER)).isTrue();

        assertThat(throttle.remainingLock(USER))
                .isEqualTo(LoginThrottle.LOCK_DURATION);
    }

    @Test
    void lockCountsDownAndThenEnds() {
        failTimes(USER, LoginThrottle.MAX_FAILURES);

        clock.advance(Duration.ofMinutes(4));

        assertThat(throttle.remainingLock(USER))
                .isEqualTo(Duration.ofMinutes(1));

        clock.advance(Duration.ofMinutes(1));

        assertThat(throttle.remainingLock(USER).isZero()).isTrue();
    }

    @Test
    void failuresDuringALockDoNotRestartIt() {
        failTimes(USER, LoginThrottle.MAX_FAILURES);

        clock.advance(Duration.ofMinutes(2));

        assertThat(throttle.recordFailure(USER)).isFalse();

        assertThat(throttle.remainingLock(USER))
                .isEqualTo(Duration.ofMinutes(3));
    }

    @Test
    void startsCountingAgainAfterALockEnds() {
        failTimes(USER, LoginThrottle.MAX_FAILURES);

        clock.advance(LoginThrottle.LOCK_DURATION);

        assertThat(throttle.remainingLock(USER).isZero()).isTrue();

        failTimes(USER, LoginThrottle.MAX_FAILURES - 1);

        assertThat(throttle.remainingLock(USER).isZero()).isTrue();
        assertThat(throttle.recordFailure(USER)).isTrue();
    }

    @Test
    void forgetsFailuresOutsideTheWindow() {
        failTimes(USER, LoginThrottle.MAX_FAILURES - 1);

        clock.advance(
                LoginThrottle.FAILURE_WINDOW.plusMinutes(1)
        );

        failTimes(USER, LoginThrottle.MAX_FAILURES - 1);

        assertThat(throttle.remainingLock(USER).isZero()).isTrue();
        assertThat(throttle.recordFailure(USER)).isTrue();
    }

    @Test
    void aSuccessfulSignInClearsTheCount() {
        failTimes(USER, LoginThrottle.MAX_FAILURES - 1);

        throttle.recordSuccess(USER);

        failTimes(USER, LoginThrottle.MAX_FAILURES - 1);

        assertThat(throttle.remainingLock(USER).isZero()).isTrue();
    }

    @Test
    void keepsEachUserNameSeparate() {
        failTimes(USER, LoginThrottle.MAX_FAILURES);

        assertThat(throttle.remainingLock(USER).isZero()).isFalse();

        assertThat(
                throttle.remainingLock("admin@fincrime.local")
                        .isZero()
        ).isTrue();
    }

    @Test
    void ignoresCaseAndSurroundingSpaces() {
        failTimes("  ANALYST@Fincrime.local ", LoginThrottle.MAX_FAILURES);

        assertThat(throttle.remainingLock(USER).isZero()).isFalse();
    }

    @Test
    void treatsMissingNamesLikeAnyOtherName() {
        failTimes(null, LoginThrottle.MAX_FAILURES);

        assertThat(throttle.remainingLock("").isZero()).isFalse();
        assertThat(throttle.remainingLock(null).isZero()).isFalse();
    }

    @Test
    void dropsIdleNamesWhenTooManyAreTracked() {
        for (int i = 0; i < LoginThrottle.MAX_TRACKED_NAMES; i++) {
            throttle.recordFailure("guess-" + i);
        }

        assertThat(throttle.trackedNames())
                .isEqualTo(LoginThrottle.MAX_TRACKED_NAMES);

        clock.advance(
                LoginThrottle.FAILURE_WINDOW.plusMinutes(1)
        );

        throttle.recordFailure("one-more");

        assertThat(throttle.trackedNames()).isEqualTo(1);
    }

    @Test
    void reportsAtLeastOneSecondToWait() {
        assertThat(
                new LoginThrottledException(Duration.ofMillis(1))
                        .getRetryAfterSeconds()
        ).isEqualTo(1L);

        assertThat(
                new LoginThrottledException(Duration.ofSeconds(90))
                        .getRetryAfterSeconds()
        ).isEqualTo(90L);

        assertThat(
                new LoginThrottledException(Duration.ofMillis(90_001))
                        .getRetryAfterSeconds()
        ).isEqualTo(91L);
    }

    private void failTimes(String username, int times) {
        for (int i = 0; i < times; i++) {
            throttle.recordFailure(username);
        }
    }

    private static final class MutableClock extends Clock {

        private Instant now;

        MutableClock(Instant start) {
            this.now = start;
        }

        void advance(Duration amount) {
            now = now.plus(amount);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now;
        }
    }
}
