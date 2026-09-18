package com.fincrimegraph.platform.service;

import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class InvestigationTriageScorer {

    public TriageScore score(
            TriageInput input
    ) {
        int priorityPoints =
                priorityPoints(
                        input.priority()
                );

        int slaPoints =
                slaPoints(
                        input.slaState(),
                        input.targetHours(),
                        input.elapsedHours()
                );

        int agePoints =
                agePoints(
                        input.caseStatus(),
                        input.ageHours()
                );

        int statusPoints =
                statusPoints(
                        input.caseStatus()
                );

        int score =
                Math.min(
                        100,
                        priorityPoints
                                + slaPoints
                                + agePoints
                                + statusPoints
                );

        String band =
                band(
                        score
                );

        String explanation =
                "Priority "
                        + normalize(
                        input.priority(),
                        "UNKNOWN"
                )
                        + " contributed "
                        + priorityPoints
                        + " points; SLA state "
                        + normalize(
                        input.slaState(),
                        "UNTRACKED"
                )
                        + " contributed "
                        + slaPoints
                        + " points; case age "
                        + Math.max(
                        0L,
                        input.ageHours()
                )
                        + "h contributed "
                        + agePoints
                        + " points; status "
                        + normalize(
                        input.caseStatus(),
                        "UNKNOWN"
                )
                        + " contributed "
                        + statusPoints
                        + " points.";

        return new TriageScore(
                score,
                band,
                priorityPoints,
                slaPoints,
                agePoints,
                statusPoints,
                explanation
        );
    }

    private int priorityPoints(
            String priority
    ) {
        return switch (
                normalize(
                        priority,
                        "LOW"
                )
        ) {
            case "CRITICAL" -> 40;
            case "HIGH" -> 30;
            case "MEDIUM" -> 20;
            case "LOW" -> 10;
            default -> 5;
        };
    }

    private int slaPoints(
            String slaState,
            Integer targetHours,
            Long elapsedHours
    ) {
        String state =
                normalize(
                        slaState,
                        "UNTRACKED"
                );

        if (
                "BREACHED".equals(
                        state
                )
        ) {
            return 35;
        }

        if (
                "CLOSED_BREACHED".equals(
                        state
                )
        ) {
            return 25;
        }

        if (
                "CLOSED_WITHIN_SLA".equals(
                        state
                )
        ) {
            return 0;
        }

        if (
                !"WITHIN_SLA".equals(
                        state
                )
        ) {
            return 0;
        }

        if (
                targetHours == null
                        || targetHours <= 0
                        || elapsedHours == null
        ) {
            return 5;
        }

        double pressure =
                Math.max(
                        0.0,
                        (double)
                                elapsedHours
                                / targetHours
                );

        if (
                pressure >= 0.75
        ) {
            return 20;
        }

        if (
                pressure >= 0.50
        ) {
            return 10;
        }

        return 5;
    }

    private int agePoints(
            String caseStatus,
            long ageHours
    ) {
        if (
                "CLOSED".equals(
                        normalize(
                                caseStatus,
                                ""
                        )
                )
        ) {
            return 0;
        }

        if (
                ageHours >= 72
        ) {
            return 15;
        }

        if (
                ageHours >= 24
        ) {
            return 10;
        }

        if (
                ageHours >= 8
        ) {
            return 5;
        }

        return 0;
    }

    private int statusPoints(
            String caseStatus
    ) {
        return switch (
                normalize(
                        caseStatus,
                        ""
                )
        ) {
            case "OPEN" -> 10;
            case "IN_REVIEW" -> 5;
            case "CLOSED" -> 0;
            default -> 5;
        };
    }

    private String band(
            int score
    ) {
        if (
                score >= 75
        ) {
            return "URGENT";
        }

        if (
                score >= 55
        ) {
            return "HIGH";
        }

        if (
                score >= 30
        ) {
            return "MEDIUM";
        }

        return "ROUTINE";
    }

    private String normalize(
            String value,
            String fallback
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return fallback;
        }

        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    public record TriageInput(
            String priority,
            String caseStatus,
            String slaState,
            Integer targetHours,
            Long elapsedHours,
            long ageHours
    ) {
    }

    public record TriageScore(
            int score,
            String band,
            int priorityPoints,
            int slaPoints,
            int agePoints,
            int statusPoints,
            String explanation
    ) {
    }
}
