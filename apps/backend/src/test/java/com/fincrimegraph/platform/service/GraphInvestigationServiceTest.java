package com.fincrimegraph.platform.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class GraphInvestigationServiceTest {

    private final GraphInvestigationService service =
            new GraphInvestigationService(null);

    @Test
    void rejectsPathDepthBelowOne() {
        assertThatThrownBy(
                () ->
                        service.shortestPath(
                                "FCG-1",
                                "FCG-2",
                                0
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "maxHops must be between 1 and 5"
                );
    }

    @Test
    void rejectsPathDepthAboveFive() {
        assertThatThrownBy(
                () ->
                        service.shortestPath(
                                "FCG-1",
                                "FCG-2",
                                6
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "maxHops must be between 1 and 5"
                );
    }

    @Test
    void rejectsNeighborhoodDepthAboveFour() {
        assertThatThrownBy(
                () ->
                        service.neighborhood(
                                "FCG-1",
                                5
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "depth must be between 1 and 4"
                );
    }

    @Test
    void rejectsIdenticalPathEndpoints() {
        assertThatThrownBy(
                () ->
                        service.shortestPath(
                                "FCG-1",
                                "FCG-1",
                                4
                        )
        )
                .isInstanceOf(
                        IllegalArgumentException.class
                )
                .hasMessageContaining(
                        "must be different"
                );
    }
}
