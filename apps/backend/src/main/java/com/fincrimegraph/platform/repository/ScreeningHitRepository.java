package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.ScreeningHitEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ScreeningHitRepository
        extends JpaRepository<ScreeningHitEntity, UUID> {

    @EntityGraph(
            attributePaths = {
                    "run",
                    "watchlistEntry",
                    "customer"
            }
    )
    List<ScreeningHitEntity>
    findByRun_IdOrderByMatchScoreDescCreatedAtAsc(
            UUID runId
    );

    @Override
    @EntityGraph(
            attributePaths = {
                    "run",
                    "watchlistEntry",
                    "customer"
            }
    )
    Optional<ScreeningHitEntity>
    findById(
            UUID id
    );
}
