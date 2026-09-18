package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.WatchlistEntryEntity;
import org.springframework.stereotype.Component;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Component
public class WatchlistMatcher {

    public static final int MATCH_THRESHOLD =
            80;

    public MatchResult match(
            CustomerEntity customer,
            WatchlistEntryEntity entry
    ) {
        String customerName =
                normalizeName(
                        customer.getFullName()
                );

        List<String> candidates =
                new ArrayList<>();

        candidates.add(
                entry.getFullName()
        );

        if (
                entry.getAliases() != null
                        && !entry
                        .getAliases()
                        .isBlank()
        ) {
            for (
                    String alias
                            : entry
                            .getAliases()
                            .split(
                                    "\\|"
                            )
            ) {
                if (
                        !alias.isBlank()
                ) {
                    candidates.add(
                            alias.trim()
                    );
                }
            }
        }

        int bestNameScore =
                0;

        String matchedName =
                entry.getFullName();

        for (
                String candidate
                        : candidates
        ) {
            int score =
                    similarity(
                            customerName,
                            normalizeName(
                                    candidate
                            )
                    );

            if (
                    score >
                            bestNameScore
            ) {
                bestNameScore =
                        score;

                matchedName =
                        candidate;
            }
        }

        boolean countryMatch =
                entry.getCountryCode()
                        != null
                        && customer
                        .getCountryCode()
                        != null
                        && entry
                        .getCountryCode()
                        .equalsIgnoreCase(
                                customer
                                        .getCountryCode()
                        );

        int matchScore =
                Math.min(
                        100,
                        bestNameScore
                                + (
                                countryMatch
                                        ? 5
                                        : 0
                        )
                );

        return new MatchResult(
                matchScore
                        >= MATCH_THRESHOLD,
                bestNameScore,
                countryMatch,
                matchScore,
                matchedName
        );
    }

    String normalizeName(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return "";
        }

        String decomposed =
                Normalizer.normalize(
                        value,
                        Normalizer.Form.NFD
                );

        return decomposed
                .replaceAll(
                        "\\p{M}+",
                        ""
                )
                .toUpperCase(
                        Locale.ROOT
                )
                .replaceAll(
                        "[^A-Z0-9]+",
                        " "
                )
                .trim()
                .replaceAll(
                        "\\s+",
                        " "
                );
    }

    int similarity(
            String left,
            String right
    ) {
        if (
                left.equals(
                        right
                )
        ) {
            return 100;
        }

        if (
                left.isEmpty()
                        || right.isEmpty()
        ) {
            return 0;
        }

        int distance =
                levenshtein(
                        left,
                        right
                );

        int maximumLength =
                Math.max(
                        left.length(),
                        right.length()
                );

        double similarity =
                1.0d
                        - (
                        (double) distance
                                / maximumLength
                );

        return Math.max(
                0,
                Math.min(
                        100,
                        (int) Math.round(
                                similarity
                                        * 100.0d
                        )
                )
        );
    }

    private int levenshtein(
            String left,
            String right
    ) {
        int[] previous =
                new int[
                        right.length()
                                + 1
                        ];

        for (
                int column = 0;
                column <= right.length();
                column++
        ) {
            previous[column] =
                    column;
        }

        for (
                int row = 1;
                row <= left.length();
                row++
        ) {
            int[] current =
                    new int[
                            right.length()
                                    + 1
                            ];

            current[0] =
                    row;

            for (
                    int column = 1;
                    column <= right.length();
                    column++
            ) {
                int insertion =
                        current[
                                column - 1
                                ]
                                + 1;

                int deletion =
                        previous[
                                column
                                ]
                                + 1;

                int substitution =
                        previous[
                                column - 1
                                ]
                                + (
                                left.charAt(
                                        row - 1
                                )
                                        ==
                                        right.charAt(
                                                column - 1
                                        )
                                        ? 0
                                        : 1
                        );

                current[column] =
                        Math.min(
                                insertion,
                                Math.min(
                                        deletion,
                                        substitution
                                )
                        );
            }

            previous =
                    current;
        }

        return previous[
                right.length()
                ];
    }

    public record MatchResult(
            boolean matched,
            int nameScore,
            boolean countryMatch,
            int matchScore,
            String matchedName
    ) {
    }
}
