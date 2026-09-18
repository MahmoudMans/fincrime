package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Component
public class DecisionGovernancePolicy {

    private static final Set<String> RECOMMENDATIONS =
            Set.of(
                    "ESCALATE",
                    "CONTINUE_INVESTIGATION",
                    "CLOSE_NO_ACTION"
            );

    private static final Set<String> REVIEW_DECISIONS =
            Set.of(
                    "APPROVED",
                    "REJECTED"
            );

    public String recommendation(String value) {
        String normalized = normalize(value, "recommendation");

        if (!RECOMMENDATIONS.contains(normalized)) {
            throw new IllegalArgumentException(
                    "Unsupported recommendation: " + value
            );
        }

        return normalized;
    }

    public String reviewDecision(String value) {
        String normalized = normalize(value, "decision");

        if (!REVIEW_DECISIONS.contains(normalized)) {
            throw new IllegalArgumentException(
                    "Unsupported review decision: " + value
            );
        }

        return normalized;
    }

    public void requireIndependentReviewer(
            String proposedBy,
            String reviewedBy
    ) {
        String proposer =
                normalizeIdentity(proposedBy, "proposedBy");

        String reviewer =
                normalizeIdentity(reviewedBy, "reviewedBy");

        if (proposer.equalsIgnoreCase(reviewer)) {
            throw new IllegalArgumentException(
                    "Four-eyes review requires a reviewer different from the proposer."
            );
        }
    }

    private String normalize(
            String value,
            String field
    ) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    field + " is required."
            );
        }

        return value
                .trim()
                .toUpperCase(Locale.ROOT);
    }

    private String normalizeIdentity(
            String value,
            String field
    ) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    field + " is required."
            );
        }

        return value.trim();
    }
}
