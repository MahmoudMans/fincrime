package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class SecurityAuditLedgerHasher {

    public static final String GENESIS_HASH =
            "0".repeat(
                    64
            );

    public String eventHash(
            AuditEvent event
    ) {
        StringBuilder canonical =
                new StringBuilder();

        appendField(
                canonical,
                event.id()
                        .toString()
        );

        appendField(
                canonical,
                event.username()
        );

        appendField(
                canonical,
                event.action()
        );

        appendField(
                canonical,
                event.resourceType()
        );

        appendField(
                canonical,
                event.resourceId()
        );

        appendField(
                canonical,
                event.outcome()
        );

        appendField(
                canonical,
                event.detail()
        );

        appendField(
                canonical,
                event.occurredAt()
                        .toString()
        );

        return sha256(
                canonical.toString()
        );
    }

    public String chainHash(
            String previousChainHash,
            String eventHash
    ) {
        String previous =
                previousChainHash == null
                        || previousChainHash
                        .isBlank()
                        ? GENESIS_HASH
                        : previousChainHash;

        return sha256(
                previous
                        + ":"
                        + eventHash
        );
    }

    private void appendField(
            StringBuilder builder,
            String value
    ) {
        String normalized =
                value == null
                        ? ""
                        : value;

        builder
                .append(
                        normalized.length()
                )
                .append(
                        ':'
                )
                .append(
                        normalized
                )
                .append(
                        '|'
                );
    }

    private String sha256(
            String value
    ) {
        try {
            MessageDigest digest =
                    MessageDigest.getInstance(
                            "SHA-256"
                    );

            return HexFormat
                    .of()
                    .formatHex(
                            digest.digest(
                                    value.getBytes(
                                            StandardCharsets.UTF_8
                                    )
                            )
                    );

        } catch (
                NoSuchAlgorithmException exception
        ) {
            throw new IllegalStateException(
                    "SHA-256 unavailable.",
                    exception
            );
        }
    }

    public record AuditEvent(
            UUID id,
            String username,
            String action,
            String resourceType,
            String resourceId,
            String outcome,
            String detail,
            Instant occurredAt
    ) {
    }
}
