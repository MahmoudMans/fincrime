package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class DecisionExecutionPolicy {

    public String outcomeFor(
            String recommendation
    ) {
        String normalized =
                normalize(
                        recommendation
                );

        return switch (normalized) {
            case "ESCALATE" ->
                    "ESCALATED_FOR_REVIEW";

            case "CONTINUE_INVESTIGATION" ->
                    "CONTINUE_INVESTIGATION";

            case "CLOSE_NO_ACTION" ->
                    "CLOSED_NO_ACTION";

            default ->
                    throw new IllegalArgumentException(
                            "Unsupported approved recommendation: "
                                    + recommendation
                    );
        };
    }

    public void requireApproved(
            String proposalStatus
    ) {
        String normalized =
                normalize(
                        proposalStatus
                );

        if (
                !"APPROVED".equals(
                        normalized
                )
        ) {
            throw new IllegalArgumentException(
                    "Only APPROVED decision proposals may be executed."
            );
        }
    }

    public void requireReviewed(
            String reviewedBy
    ) {
        if (
                reviewedBy == null
                        || reviewedBy.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "An approved proposal requires an independent review before execution."
            );
        }
    }

    private String normalize(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return "";
        }

        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }
}
