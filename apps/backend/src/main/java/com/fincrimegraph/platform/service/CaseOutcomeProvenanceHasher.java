package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class CaseOutcomeProvenanceHasher {

    public String hash(
            ProvenanceSnapshot snapshot
    ) {
        StringBuilder canonical =
                new StringBuilder();

        field(
                canonical,
                snapshot.caseId().toString()
        );

        field(
                canonical,
                snapshot.executionId().toString()
        );

        field(
                canonical,
                snapshot.proposalId().toString()
        );

        field(
                canonical,
                Integer.toString(
                        snapshot.decisionVersion()
                )
        );

        field(
                canonical,
                snapshot.sourceRecommendation()
        );

        field(
                canonical,
                snapshot.governedOutcome()
        );

        field(
                canonical,
                snapshot.sourceProposedBy()
        );

        field(
                canonical,
                snapshot.sourceReviewedBy()
        );

        field(
                canonical,
                snapshot.executionNote()
        );

        field(
                canonical,
                snapshot.executedBy()
        );

        field(
                canonical,
                snapshot.executedAt().toString()
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
                .append(':')
                .append(
                        normalized
                )
                .append('|');
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

    public record ProvenanceSnapshot(
            UUID caseId,
            UUID executionId,
            UUID proposalId,
            int decisionVersion,
            String sourceRecommendation,
            String governedOutcome,
            String sourceProposedBy,
            String sourceReviewedBy,
            String executionNote,
            String executedBy,
            Instant executedAt
    ) {
    }
}
