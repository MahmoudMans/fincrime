package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.AuthService;
import com.fincrimegraph.platform.security.LoginThrottledException;
import com.fincrimegraph.platform.security.TokenService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(
            AuthService authService
    ) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(
            @RequestParam
            String username,

            @RequestParam
            String password
    ) {
        try {
            TokenService.TokenView token =
                    authService.login(
                            username,
                            password
                    );

            return ResponseEntity.ok(
                    token
            );

        } catch (
                LoginThrottledException exception
        ) {
            long seconds =
                    exception.getRetryAfterSeconds();

            long minutes =
                    Math.max(
                            1L,
                            (seconds + 59L) / 60L
                    );

            return ResponseEntity
                    .status(
                            HttpStatus
                                    .TOO_MANY_REQUESTS
                    )
                    .header(
                            HttpHeaders.RETRY_AFTER,
                            String.valueOf(seconds)
                    )
                    .body(
                            Map.<String, Object>of(
                                    "error",
                                    "TOO_MANY_ATTEMPTS",
                                    "message",
                                    "Too many failed sign-in attempts. Try again in "
                                            + minutes
                                            + (minutes == 1L
                                            ? " minute."
                                            : " minutes."),
                                    "retryAfterSeconds",
                                    seconds
                            )
                    );

        } catch (
                AuthenticationException exception
        ) {
            return ResponseEntity
                    .status(
                            HttpStatus
                                    .UNAUTHORIZED
                    )
                    .body(
                            Map.of(
                                    "error",
                                    "INVALID_CREDENTIALS",
                                    "message",
                                    "Username or password is invalid."
                            )
                    );
        }
    }

    @GetMapping("/me")
    public AuthService.AuthUserView me(
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        return authService
                .currentUser(jwt);
    }
}
