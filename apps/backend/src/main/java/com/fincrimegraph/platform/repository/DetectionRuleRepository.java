package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.DetectionRuleEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DetectionRuleRepository
        extends JpaRepository<DetectionRuleEntity, UUID> {

    Optional<DetectionRuleEntity>
    findByRuleKey(String ruleKey);

    List<DetectionRuleEntity>
    findAllByOrderByRuleKeyAsc();

    long countByEnabledTrue();
}
