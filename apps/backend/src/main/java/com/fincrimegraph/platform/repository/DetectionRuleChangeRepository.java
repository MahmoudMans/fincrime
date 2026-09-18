package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.DetectionRuleChangeEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DetectionRuleChangeRepository
        extends JpaRepository<DetectionRuleChangeEntity, UUID> {

    @EntityGraph(attributePaths = "rule")
    List<DetectionRuleChangeEntity>
    findByRule_RuleKeyOrderByVersionDesc(
            String ruleKey
    );
}
