package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Component
public class InvestigationFindingPolicy {

    private static final Set<String> REVIEW_DECISIONS =
            Set.of(
                    "APPROVED",
                    "REJECTED"
            );

    public void requireAcceptedEvidenceReview(
            String evidenceStatus,
            String evidenceReviewDecision,
            boolean lineageCurrent
    ) {
        if (
                evidenceStatus == null
                        || !"VERIFIED".equalsIgnoreCase(
                        evidenceStatus.trim()
                )
        ) {
            throw new IllegalArgumentException(
                    "Investigation findings require integrity-verified evidence."
            );
        }

        if (
                evidenceReviewDecision == null
                        || !"ACCEPTED_FOR_ANALYSIS".equalsIgnoreCase(
                        evidenceReviewDecision.trim()
                )
        ) {
            throw new IllegalArgumentException(
                    "Investigation findings require evidence accepted for analytical use."
            );
        }

        if (
                !lineageCurrent
        ) {
            throw new IllegalArgumentException(
                    "Investigation findings require a review anchored to the current evidence lineage."
            );
        }
    }

    public String reviewDecision(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "decision is required."
            );
        }

        String normalized =
                value
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        if (
                !REVIEW_DECISIONS.contains(
                        normalized
                )
        ) {
            throw new IllegalArgumentException(
                    "Unsupported investigation finding review decision: "
                            + value
            );
        }

        return normalized;
    }

    public void requireIndependentReviewer(
            String submittedBy,
            String reviewedBy
    ) {
        if (
                submittedBy == null
                        || submittedBy.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Finding submitter is required."
            );
        }

        if (
                reviewedBy == null
                        || reviewedBy.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Finding reviewer is required."
            );
        }

        if (
                submittedBy
                        .trim()
                        .equalsIgnoreCase(
                                reviewedBy.trim()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Finding review requires a reviewer different from the finding submitter."
            );
        }
    }
}
