package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class ConclusionReleaseFingerprint {

    public String hash(
            Snapshot snapshot
    ) {
        StringBuilder canonical =
                new StringBuilder();

        field(
                canonical,
                snapshot.caseId()
                        .toString()
        );

        field(
                canonical,
                Integer.toString(
                        snapshot.packageVersion()
                )
        );

        field(
                canonical,
                snapshot.findingId()
                        .toString()
        );

        field(
                canonical,
                Integer.toString(
                        snapshot.findingVersion()
                )
        );

        field(
                canonical,
                snapshot.findingReference()
        );

        field(
                canonical,
                snapshot.findingTitle()
        );

        field(
                canonical,
                snapshot.findingNarrative()
        );

        field(
                canonical,
                snapshot.findingReviewId()
                        .toString()
        );

        field(
                canonical,
                snapshot.findingReviewedBy()
        );

        field(
                canonical,
                snapshot.evidenceId()
                        .toString()
        );

        field(
                canonical,
                snapshot.evidenceReviewId()
                        .toString()
        );

        field(
                canonical,
                Integer.toString(
                        snapshot.evidenceReviewVersion()
                )
        );

        field(
                canonical,
                snapshot.evidenceRegistryFingerprint()
        );

        field(
                canonical,
                snapshot.evidenceCustodyHeadHash()
        );

        field(
                canonical,
                snapshot.outcomeExecutionId()
                        .toString()
        );

        field(
                canonical,
                snapshot.outcomeProposalId()
                        .toString()
        );

        field(
                canonical,
                Integer.toString(
                        snapshot.outcomeDecisionVersion()
                )
        );

        field(
                canonical,
                snapshot.governedOutcome()
        );

        field(
                canonical,
                snapshot.outcomeAttestationId()
                        .toString()
        );

        field(
                canonical,
                snapshot.outcomeProvenanceHash()
        );

        field(
                canonical,
                snapshot.outcomeAuditRootHash()
        );

        field(
                canonical,
                snapshot.conclusionSummary()
        );

        field(
                canonical,
                snapshot.releaseRationale()
        );

        field(
                canonical,
                snapshot.preparedBy()
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

    public record Snapshot(
            UUID caseId,
            int packageVersion,
            UUID findingId,
            int findingVersion,
            String findingReference,
            String findingTitle,
            String findingNarrative,
            UUID findingReviewId,
            String findingReviewedBy,
            UUID evidenceId,
            UUID evidenceReviewId,
            int evidenceReviewVersion,
            String evidenceRegistryFingerprint,
            String evidenceCustodyHeadHash,
            UUID outcomeExecutionId,
            UUID outcomeProposalId,
            int outcomeDecisionVersion,
            String governedOutcome,
            UUID outcomeAttestationId,
            String outcomeProvenanceHash,
            String outcomeAuditRootHash,
            String conclusionSummary,
            String releaseRationale,
            String preparedBy
    ) {
    }
}
