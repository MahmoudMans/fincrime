package com.fincrimegraph.platform.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import java.nio.charset.StandardCharsets;

@Configuration
@EnableMethodSecurity
public class SecurityConfiguration {

    private static final String ISSUER =
            "fincrime-graph";

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(
            PasswordEncoder passwordEncoder,

            @Value(
                    "${app.security.analyst-password}"
            )
            String analystPassword,

            @Value(
                    "${app.security.senior-password}"
            )
            String seniorPassword,

            @Value(
                    "${app.security.admin-password}"
            )
            String adminPassword
    ) {
        UserDetails analyst =
                User
                        .withUsername(
                                "analyst@fincrime.local"
                        )
                        .password(
                                passwordEncoder.encode(
                                        analystPassword
                                )
                        )
                        .roles(
                                "AML_ANALYST"
                        )
                        .build();

        UserDetails senior =
                User
                        .withUsername(
                                "senior@fincrime.local"
                        )
                        .password(
                                passwordEncoder.encode(
                                        seniorPassword
                                )
                        )
                        .roles(
                                "SENIOR_ANALYST"
                        )
                        .build();

        UserDetails admin =
                User
                        .withUsername(
                                "admin@fincrime.local"
                        )
                        .password(
                                passwordEncoder.encode(
                                        adminPassword
                                )
                        )
                        .roles(
                                "ADMIN"
                        )
                        .build();

        return new InMemoryUserDetailsManager(
                analyst,
                senior,
                admin
        );
    }

    @Bean
    public DaoAuthenticationProvider
    authenticationProvider(
            UserDetailsService userDetailsService,
            PasswordEncoder passwordEncoder
    ) {
        DaoAuthenticationProvider provider =
                new DaoAuthenticationProvider(
                        userDetailsService
                );

        provider.setPasswordEncoder(
                passwordEncoder
        );

        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(
            DaoAuthenticationProvider provider
    ) {
        return new ProviderManager(
                provider
        );
    }

    @Bean
    public SecretKey jwtSecretKey(
            @Value(
                    "${app.security.jwt-secret}"
            )
            String configuredSecret
    ) {
        byte[] bytes =
                configuredSecret
                        .getBytes(
                                StandardCharsets
                                        .UTF_8
                        );

        if (bytes.length < 32) {
            throw new IllegalStateException(
                    "JWT secret must be at least "
                            + "32 UTF-8 bytes."
            );
        }

        return new SecretKeySpec(
                bytes,
                "HmacSHA256"
        );
    }

    @Bean
    public JwtEncoder jwtEncoder(
            SecretKey secretKey
    ) {
        return NimbusJwtEncoder
                .withSecretKey(
                        secretKey
                )
                .algorithm(
                        MacAlgorithm.HS256
                )
                .build();
    }

    @Bean
    public JwtDecoder jwtDecoder(
            SecretKey secretKey
    ) {
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder
                        .withSecretKey(
                                secretKey
                        )
                        .macAlgorithm(
                                MacAlgorithm
                                        .HS256
                        )
                        .build();

        decoder.setJwtValidator(
                JwtValidators
                        .createDefaultWithIssuer(
                                ISSUER
                        )
        );

        return decoder;
    }

    @Bean
    public JwtAuthenticationConverter
    jwtAuthenticationConverter() {

        JwtGrantedAuthoritiesConverter
                authoritiesConverter =
                new JwtGrantedAuthoritiesConverter();

        authoritiesConverter
                .setAuthoritiesClaimName(
                        "roles"
                );

        authoritiesConverter
                .setAuthorityPrefix(
                        "ROLE_"
                );

        JwtAuthenticationConverter converter =
                new JwtAuthenticationConverter();

        converter
                .setJwtGrantedAuthoritiesConverter(
                        authoritiesConverter
                );

        return converter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            JwtAuthenticationConverter
                    jwtAuthenticationConverter
    ) throws Exception {

        http
                .cors(
                        Customizer.withDefaults()
                )
                .csrf(
                        csrf ->
                                csrf.disable()
                )
                .sessionManagement(
                        session ->
                                session
                                        .sessionCreationPolicy(
                                                SessionCreationPolicy.STATELESS
                                        )
                )
                .authorizeHttpRequests(
                        authorization ->
                                authorization
                                        .requestMatchers(
                                                "/api/v1/auth/login",
                                                "/actuator/health",
                                                "/actuator/health/**",
                                                "/error"
                                        )
                                        .permitAll()
                                        .anyRequest()
                                        .authenticated()
                )
                .oauth2ResourceServer(
                        resourceServer ->
                                resourceServer
                                        .jwt(
                                                jwt ->
                                                        jwt
                                                                .jwtAuthenticationConverter(
                                                                        jwtAuthenticationConverter
                                                                )
                                        )
                );

        return http.build();
    }
}
