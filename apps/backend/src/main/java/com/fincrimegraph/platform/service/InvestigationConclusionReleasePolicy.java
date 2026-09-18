package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

@Component
public class InvestigationConclusionReleasePolicy {

    private static final Set<String> REVIEW_DECISIONS =
            Set.of(
                    "RELEASED",
                    "REJECTED"
            );

    public void requireApprovedFinding(
            String findingStatus,
            boolean evidenceLineageCurrent
    ) {
        if (
                findingStatus == null
                        || !"APPROVED".equalsIgnoreCase(
                        findingStatus.trim()
                )
        ) {
            throw new IllegalArgumentException(
                    "Conclusion release packages require an APPROVED investigation finding."
            );
        }

        if (
                !evidenceLineageCurrent
        ) {
            throw new IllegalArgumentException(
                    "Conclusion release packages require a finding whose evidence lineage is still current."
            );
        }
    }

    public void requireIndependentReviewer(
            String preparedBy,
            String reviewedBy
    ) {
        if (
                preparedBy == null
                        || preparedBy.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Package preparer is required."
            );
        }

        if (
                reviewedBy == null
                        || reviewedBy.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "Package reviewer is required."
            );
        }

        if (
                preparedBy
                        .trim()
                        .equalsIgnoreCase(
                                reviewedBy.trim()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Conclusion release review requires a reviewer different from the package preparer."
            );
        }
    }

    public String decision(
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
                    "Unsupported conclusion release decision: "
                            + value
            );
        }

        return normalized;
    }

    public void requireReleasableIntegrity(
            boolean fingerprintValid,
            boolean findingLineageCurrent,
            boolean outcomeLineageCurrent
    ) {
        if (
                !fingerprintValid
        ) {
            throw new IllegalArgumentException(
                    "Conclusion package release fingerprint verification failed."
            );
        }

        if (
                !findingLineageCurrent
        ) {
            throw new IllegalArgumentException(
                    "Conclusion package finding/evidence lineage is no longer current."
            );
        }

        if (
                !outcomeLineageCurrent
        ) {
            throw new IllegalArgumentException(
                    "Conclusion package governed-outcome provenance is no longer current."
            );
        }
    }
}
