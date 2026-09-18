package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.ScreeningRunEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ScreeningRunRepository
        extends JpaRepository<ScreeningRunEntity, UUID> {

    List<ScreeningRunEntity>
    findTop20ByOrderByStartedAtDesc();
}
