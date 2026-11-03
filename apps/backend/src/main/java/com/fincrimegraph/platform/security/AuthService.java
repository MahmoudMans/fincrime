package com.fincrimegraph.platform.security;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.List;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;
    private final SecurityAuditService auditService;
    private final LoginThrottle loginThrottle;

    public AuthService(
            AuthenticationManager authenticationManager,
            TokenService tokenService,
            SecurityAuditService auditService,
            LoginThrottle loginThrottle
    ) {
        this.authenticationManager =
                authenticationManager;

        this.tokenService =
                tokenService;

        this.auditService =
                auditService;

        this.loginThrottle =
                loginThrottle;
    }

    public TokenService.TokenView login(
            String username,
            String password
    ) throws AuthenticationException {

        Duration wait =
                loginThrottle.remainingLock(
                        username
                );

        if (!wait.isZero()) {
            throw new LoginThrottledException(
                    wait
            );
        }

        try {
            Authentication authentication =
                    authenticationManager
                            .authenticate(
                                    UsernamePasswordAuthenticationToken
                                            .unauthenticated(
                                                    username,
                                                    password
                                            )
                            );

            String displayName =
                    displayName(
                            authentication
                                    .getName()
                    );

            TokenService.TokenView token =
                    tokenService.issue(
                            authentication,
                            displayName
                    );

            loginThrottle.recordSuccess(
                    username
            );

            auditService.record(
                    authentication.getName(),
                    "AUTH_LOGIN",
                    "SESSION",
                    null,
                    "SUCCESS",
                    "Interactive local demo login."
            );

            return token;

        } catch (
                AuthenticationException exception
        ) {
            boolean locked =
                    loginThrottle.recordFailure(
                            username
                    );

            auditService.record(
                    username,
                    "AUTH_LOGIN",
                    "SESSION",
                    null,
                    "FAILED",
                    "Invalid credentials."
            );

            if (locked) {
                auditService.record(
                        username,
                        "AUTH_LOGIN",
                        "SESSION",
                        null,
                        "LOCKED",
                        "Sign-in locked for "
                                + LoginThrottle
                                .LOCK_DURATION
                                .toMinutes()
                                + " minutes after "
                                + LoginThrottle.MAX_FAILURES
                                + " failed attempts."
                );
            }

            throw exception;
        }
    }

    public AuthUserView currentUser(
            Jwt jwt
    ) {
        List<String> roles =
                jwt.getClaimAsStringList(
                        "roles"
                );

        return new AuthUserView(
                jwt.getSubject(),
                jwt.getClaimAsString(
                        "name"
                ),
                roles == null
                        ? List.of()
                        : List.copyOf(
                                roles
                        ),
                jwt.getExpiresAt()
        );
    }

    private String displayName(
            String username
    ) {
        return switch (username) {
            case "analyst@fincrime.local" ->
                    "AML Analyst";

            case "senior@fincrime.local" ->
                    "Senior AML Analyst";

            case "admin@fincrime.local" ->
                    "Platform Administrator";

            default ->
                    username;
        };
    }

    public record AuthUserView(
            String username,
            String displayName,
            List<String> roles,
            java.time.Instant expiresAt
    ) {
    }
}
