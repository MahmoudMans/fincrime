package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.WatchlistEntryEntity;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class WatchlistMatcherTest {

    private final WatchlistMatcher matcher =
            new WatchlistMatcher();

    @Test
    void producesExactFuzzyAndUnrelatedScores() {

        CustomerEntity customer =
                new CustomerEntity(
                        UUID.randomUUID(),
                        "CUS-WATCH-001",
                        "Nadia Ben Salem",
                        "TN",
                        CustomerEntity
                                .RiskTier
                                .HIGH,
                        Instant.now()
                );

        WatchlistEntryEntity exact =
                entry(
                        "SYN-EXACT",
                        "Nadia Ben Salem",
                        "TN"
                );

        WatchlistEntryEntity fuzzy =
                entry(
                        "SYN-FUZZY",
                        "Nadya Ben Salem",
                        "TN"
                );

        WatchlistEntryEntity unrelated =
                entry(
                        "SYN-NONE",
                        "Orion Valez Qadir",
                        "XZ"
                );

        WatchlistMatcher.MatchResult exactResult =
                matcher.match(
                        customer,
                        exact
                );

        WatchlistMatcher.MatchResult fuzzyResult =
                matcher.match(
                        customer,
                        fuzzy
                );

        WatchlistMatcher.MatchResult unrelatedResult =
                matcher.match(
                        customer,
                        unrelated
                );

        assertThat(
                exactResult.matched()
        ).isTrue();

        assertThat(
                exactResult.nameScore()
        ).isEqualTo(
                100
        );

        assertThat(
                exactResult.matchScore()
        ).isEqualTo(
                100
        );

        assertThat(
                exactResult.countryMatch()
        ).isTrue();

        assertThat(
                fuzzyResult.matched()
        ).isTrue();

        assertThat(
                fuzzyResult.nameScore()
        ).isEqualTo(
                93
        );

        assertThat(
                fuzzyResult.matchScore()
        ).isEqualTo(
                98
        );

        assertThat(
                fuzzyResult.countryMatch()
        ).isTrue();

        assertThat(
                unrelatedResult.matched()
        ).isFalse();

        assertThat(
                unrelatedResult.matchScore()
        ).isLessThan(
                WatchlistMatcher
                        .MATCH_THRESHOLD
        );
    }

    @Test
    void normalizesPunctuationDiacriticsAndWhitespace() {

        assertThat(
                matcher.normalizeName(
                        "  Nádia---Ben   Salem "
                )
        ).isEqualTo(
                "NADIA BEN SALEM"
        );
    }

    private WatchlistEntryEntity entry(
            String key,
            String name,
            String country
    ) {
        return new WatchlistEntryEntity(
                UUID.randomUUID(),
                key,
                name,
                matcher.normalizeName(
                        name
                ),
                "",
                country,
                WatchlistEntryEntity
                        .WatchlistCategory
                        .SANCTIONS,
                WatchlistEntryEntity
                        .RiskLevel
                        .HIGH,
                "Synthetic Unit Test",
                key,
                true,
                Instant.now(),
                Instant.now()
        );
    }
}
