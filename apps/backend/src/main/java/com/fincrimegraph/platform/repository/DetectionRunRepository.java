package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.DetectionRunEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DetectionRunRepository
        extends JpaRepository<DetectionRunEntity, UUID> {

    List<DetectionRunEntity> findTop5ByOrderByStartedAtDesc();
}
