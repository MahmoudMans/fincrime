package com.fincrimegraph.platform.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Slows down password guessing on the login endpoint.
 *
 * After {@value #MAX_FAILURES} failed sign-ins for the same user name
 * within {@link #FAILURE_WINDOW}, further attempts for that name are
 * refused for {@link #LOCK_DURATION}, even with the right password.
 * A successful sign-in clears the count.
 *
 * The state lives in memory, so it is per application instance and is
 * reset by a restart. That is enough to stop online guessing against
 * the local demo accounts; a clustered deployment would need a shared
 * store. Names that do not exist are tracked the same way, so a caller
 * cannot tell real accounts from unknown ones by the lock.
 */
@Component
public class LoginThrottle {

    public static final int MAX_FAILURES = 5;

    public static final Duration FAILURE_WINDOW =
            Duration.ofMinutes(10);

    public static final Duration LOCK_DURATION =
            Duration.ofMinutes(5);

    static final int MAX_TRACKED_NAMES = 5000;

    static final int MAX_NAME_LENGTH = 180;

    private final Clock clock;

    private final Map<String, Attempts> attempts =
            new HashMap<>();

    @Autowired
    public LoginThrottle() {
        this(Clock.systemUTC());
    }

    LoginThrottle(Clock clock) {
        this.clock = clock;
    }

    /**
     * How long the caller still has to wait. Zero means a sign-in
     * attempt may go ahead.
     */
    public synchronized Duration remainingLock(String username) {
        String key = keyOf(username);

        Attempts entry = attempts.get(key);

        if (entry == null || entry.lockedUntil == null) {
            return Duration.ZERO;
        }

        Instant now = clock.instant();

        if (now.isBefore(entry.lockedUntil)) {
            return Duration.between(now, entry.lockedUntil);
        }

        attempts.remove(key);

        return Duration.ZERO;
    }

    /**
     * Counts one failed sign-in.
     *
     * @return true when this failure started a lock
     */
    public synchronized boolean recordFailure(String username) {
        Instant now = clock.instant();

        Attempts entry =
                attempts.computeIfAbsent(
                        keyOf(username),
                        ignored -> new Attempts()
                );

        if (entry.lockedUntil != null) {
            if (now.isBefore(entry.lockedUntil)) {
                return false;
            }

            entry.lockedUntil = null;
            entry.failures.clear();
        }

        Instant cutoff = now.minus(FAILURE_WINDOW);

        while (
                !entry.failures.isEmpty()
                        && entry.failures.peekFirst().isBefore(cutoff)
        ) {
            entry.failures.removeFirst();
        }

        entry.failures.addLast(now);

        boolean locked = false;

        if (entry.failures.size() >= MAX_FAILURES) {
            entry.failures.clear();
            entry.lockedUntil = now.plus(LOCK_DURATION);
            locked = true;
        }

        trim(now);

        return locked;
    }

    public synchronized void recordSuccess(String username) {
        attempts.remove(keyOf(username));
    }

    synchronized int trackedNames() {
        return attempts.size();
    }

    private void trim(Instant now) {
        if (attempts.size() <= MAX_TRACKED_NAMES) {
            return;
        }

        Instant cutoff = now.minus(FAILURE_WINDOW);

        attempts.values().removeIf(
                entry -> entry.isIdle(now, cutoff)
        );

        if (attempts.size() > MAX_TRACKED_NAMES) {
            attempts.values().removeIf(
                    entry -> entry.lockedUntil == null
            );
        }
    }

    static String keyOf(String username) {
        if (username == null) {
            return "";
        }

        String normalized =
                username.trim().toLowerCase(Locale.ROOT);

        return normalized.length() > MAX_NAME_LENGTH
                ? normalized.substring(0, MAX_NAME_LENGTH)
                : normalized;
    }

    private static final class Attempts {

        private final Deque<Instant> failures =
                new ArrayDeque<>();

        private Instant lockedUntil;

        boolean isIdle(Instant now, Instant cutoff) {
            if (lockedUntil != null) {
                return !now.isBefore(lockedUntil);
            }

            return failures.isEmpty()
                    || failures.peekLast().isBefore(cutoff);
        }
    }
}
