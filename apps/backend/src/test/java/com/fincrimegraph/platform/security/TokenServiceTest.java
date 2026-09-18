package com.fincrimegraph.platform.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class TokenServiceTest {

    @Test
    void issuesSignedJwtWithRoleClaims() {

        SecretKey secretKey =
                new SecretKeySpec(
                        (
                                "fincrime-graph-test-secret-"
                                        + "must-be-at-least-32-bytes"
                        )
                                .getBytes(
                                        StandardCharsets
                                                .UTF_8
                                ),
                        "HmacSHA256"
                );

        NimbusJwtEncoder encoder =
                NimbusJwtEncoder
                        .withSecretKey(
                                secretKey
                        )
                        .algorithm(
                                MacAlgorithm.HS256
                        )
                        .build();

        TokenService service =
                new TokenService(
                        encoder,
                        8
                );

        var authentication =
                new UsernamePasswordAuthenticationToken(
                        "analyst@fincrime.local",
                        null,
                        List.of(
                                new SimpleGrantedAuthority(
                                        "ROLE_AML_ANALYST"
                                )
                        )
                );

        TokenService.TokenView issued =
                service.issue(
                        authentication,
                        "AML Analyst"
                );

        NimbusJwtDecoder decoder =
                NimbusJwtDecoder
                        .withSecretKey(
                                secretKey
                        )
                        .macAlgorithm(
                                MacAlgorithm.HS256
                        )
                        .build();

        Jwt decoded =
                decoder.decode(
                        issued.accessToken()
                );

        assertThat(
                decoded.getSubject()
        ).isEqualTo(
                "analyst@fincrime.local"
        );

        assertThat(
                decoded
                        .getClaimAsStringList(
                                "roles"
                        )
        ).containsExactly(
                "AML_ANALYST"
        );

        assertThat(
                decoded.getClaimAsString(
                        "name"
                )
        ).isEqualTo(
                "AML Analyst"
        );
    }
}
