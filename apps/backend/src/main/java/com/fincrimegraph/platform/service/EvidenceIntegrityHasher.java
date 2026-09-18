package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class EvidenceIntegrityHasher {

    public static final String GENESIS_HASH =
            "0".repeat(
                    64
            );

    public String registryFingerprint(
            EvidenceSnapshot evidence
    ) {
        StringBuilder canonical =
                new StringBuilder();

        field(
                canonical,
                evidence.caseId()
                        .toString()
        );

        field(
                canonical,
                evidence.evidenceReference()
        );

        field(
                canonical,
                evidence.evidenceType()
        );

        field(
                canonical,
                evidence.title()
        );

        field(
                canonical,
                evidence.sourceReference()
        );

        field(
                canonical,
                evidence.description()
        );

        field(
                canonical,
                evidence.contentSha256()
        );

        return sha256(
                canonical.toString()
        );
    }

    public String custodyEventHash(
            String previousEventHash,
            CustodyEventSnapshot event
    ) {
        String previous =
                previousEventHash == null
                        || previousEventHash.isBlank()
                        ? GENESIS_HASH
                        : previousEventHash;

        StringBuilder canonical =
                new StringBuilder();

        field(
                canonical,
                previous
        );

        field(
                canonical,
                event.evidenceId()
                        .toString()
        );

        field(
                canonical,
                Integer.toString(
                        event.sequenceNumber()
                )
        );

        field(
                canonical,
                event.eventType()
        );

        field(
                canonical,
                event.fromCustodian()
        );

        field(
                canonical,
                event.toCustodian()
        );

        field(
                canonical,
                event.actorUsername()
        );

        field(
                canonical,
                event.eventNote()
        );

        field(
                canonical,
                event.registryFingerprint()
        );

        field(
                canonical,
                event.occurredAt()
                        .toString()
        );

        return sha256(
                canonical.toString()
        );
    }

    private void field(
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

    public record EvidenceSnapshot(
            UUID caseId,
            String evidenceReference,
            String evidenceType,
            String title,
            String sourceReference,
            String description,
            String contentSha256
    ) {
    }

    public record CustodyEventSnapshot(
            UUID evidenceId,
            int sequenceNumber,
            String eventType,
            String fromCustodian,
            String toCustodian,
            String actorUsername,
            String eventNote,
            String registryFingerprint,
            Instant occurredAt
    ) {
    }
}
