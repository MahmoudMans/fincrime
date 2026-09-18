package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Component
public class EvidenceReviewPolicy {

    private static final Set<String> DECISIONS =
            Set.of(
                    "ACCEPTED_FOR_ANALYSIS",
                    "QUESTIONED",
                    "EXCLUDED"
            );

    public String decision(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "reviewDecision is required."
            );
        }

        String normalized =
                value
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        if (
                !DECISIONS.contains(
                        normalized
                )
        ) {
            throw new IllegalArgumentException(
                    "Unsupported evidence review decision: "
                            + value
            );
        }

        return normalized;
    }

    public void requireVerifiedEvidence(
            String currentStatus
    ) {
        if (
                currentStatus == null
                        || !"VERIFIED".equalsIgnoreCase(
                        currentStatus.trim()
                )
        ) {
            throw new IllegalArgumentException(
                    "Only integrity-verified evidence may receive an analytical-use review."
            );
        }
    }

    public void requireIndependentReviewer(
            String currentCustodian,
            String reviewer
    ) {
        if (
                currentCustodian == null
                        || currentCustodian.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Evidence current custodian is required."
            );
        }

        if (
                reviewer == null
                        || reviewer.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "reviewer is required."
            );
        }

        if (
                currentCustodian
                        .trim()
                        .equalsIgnoreCase(
                                reviewer.trim()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Evidence review requires a reviewer different from the current custodian."
            );
        }
    }
}
