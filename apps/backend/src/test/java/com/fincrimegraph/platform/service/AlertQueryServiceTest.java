package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AlertQueryServiceTest {

    @Test
    void blankAndAllFiltersMeanNoFilter() {
        assertThat(AlertQueryService.parseStatus(null)).isNull();
        assertThat(AlertQueryService.parseStatus("  ")).isNull();
        assertThat(AlertQueryService.parseStatus("all")).isNull();
        assertThat(AlertQueryService.parseSeverity("ALL")).isNull();
    }

    @Test
    void parsesFiltersCaseInsensitively() {
        assertThat(AlertQueryService.parseStatus("in_review"))
                .isEqualTo(AlertEntity.AlertStatus.IN_REVIEW);

        assertThat(AlertQueryService.parseSeverity(" critical "))
                .isEqualTo(AlertEntity.AlertSeverity.CRITICAL);
    }

    @Test
    void rejectsUnknownFilterValues() {
        assertThatThrownBy(() ->
                AlertQueryService.parseStatus("MAYBE")
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported alert status");

        assertThatThrownBy(() ->
                AlertQueryService.parseSeverity("SEVERE")
        )
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported alert severity");
    }

    @Test
    void clampsPageSize() {
        assertThat(AlertQueryService.normalizeSize(0))
                .isEqualTo(AlertQueryService.DEFAULT_PAGE_SIZE);

        assertThat(AlertQueryService.normalizeSize(-5))
                .isEqualTo(AlertQueryService.DEFAULT_PAGE_SIZE);

        assertThat(AlertQueryService.normalizeSize(40))
                .isEqualTo(40);

        assertThat(AlertQueryService.normalizeSize(10_000))
                .isEqualTo(AlertQueryService.MAX_PAGE_SIZE);
    }

    @Test
    void searchTextIsLowercasedAndWildcardsAreStripped() {
        assertThat(AlertQueryService.toLikePattern(null)).isNull();
        assertThat(AlertQueryService.toLikePattern("   ")).isNull();
        assertThat(AlertQueryService.toLikePattern("%_\\")).isNull();

        assertThat(AlertQueryService.toLikePattern("  Circular FLOW "))
                .isEqualTo("%circular flow%");

        assertThat(AlertQueryService.toLikePattern("100%_off"))
                .isEqualTo("%100  off%");
    }

    @Test
    void overlongSearchTextIsTruncated() {
        String pattern =
                AlertQueryService.toLikePattern("a".repeat(500));

        assertThat(pattern)
                .hasSize(AlertQueryService.MAX_QUERY_LENGTH + 2);
    }
}
