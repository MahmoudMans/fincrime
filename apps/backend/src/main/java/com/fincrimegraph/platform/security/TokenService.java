package com.fincrimegraph.platform.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class TokenService {

    private static final String ISSUER =
            "fincrime-graph";

    private final JwtEncoder jwtEncoder;
    private final Duration tokenLifetime;

    public TokenService(
            JwtEncoder jwtEncoder,

            @Value(
                    "${app.security.token-hours:8}"
            )
            int tokenHours
    ) {
        this.jwtEncoder = jwtEncoder;
        this.tokenLifetime =
                Duration.ofHours(
                        tokenHours
                );
    }

    public TokenView issue(
            Authentication authentication,
            String displayName
    ) {
        Instant issuedAt =
                Instant.now();

        Instant expiresAt =
                issuedAt.plus(
                        tokenLifetime
                );

        List<String> roles =
                authentication
                        .getAuthorities()
                        .stream()
                        .map(
                                authority ->
                                        authority
                                                .getAuthority()
                        )
                        .filter(
                                authority ->
                                        authority
                                                .startsWith(
                                                        "ROLE_"
                                                )
                        )
                        .map(
                                authority ->
                                        authority
                                                .substring(
                                                        "ROLE_"
                                                                .length()
                                                )
                        )
                        .sorted()
                        .toList();

        JwtClaimsSet claims =
                JwtClaimsSet
                        .builder()
                        .issuer(ISSUER)
                        .subject(
                                authentication
                                        .getName()
                        )
                        .issuedAt(issuedAt)
                        .expiresAt(expiresAt)
                        .claim(
                                "name",
                                displayName
                        )
                        .claim(
                                "roles",
                                roles
                        )
                        .build();

        JwsHeader header =
                JwsHeader
                        .with(
                                MacAlgorithm
                                        .HS256
                        )
                        .type("JWT")
                        .build();

        String token =
                jwtEncoder
                        .encode(
                                JwtEncoderParameters
                                        .from(
                                                header,
                                                claims
                                        )
                        )
                        .getTokenValue();

        return new TokenView(
                token,
                "Bearer",
                expiresAt,
                authentication.getName(),
                displayName,
                roles
        );
    }

    public record TokenView(
            String accessToken,
            String tokenType,
            Instant expiresAt,
            String username,
            String displayName,
            List<String> roles
    ) {
    }
}
