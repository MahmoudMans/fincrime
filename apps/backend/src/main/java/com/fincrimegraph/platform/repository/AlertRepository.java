package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.AlertEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AlertRepository
        extends JpaRepository<AlertEntity, UUID> {

    long countByStatusNot(
            AlertEntity.AlertStatus status
    );

    boolean existsByAlertCode(String alertCode);

    @Override
    @EntityGraph(attributePaths = {
            "primaryAccount",
            "primaryAccount.customer",
            "transaction"
    })
    List<AlertEntity> findAll();

    @EntityGraph(attributePaths = {
            "primaryAccount",
            "primaryAccount.customer",
            "transaction"
    })
    List<AlertEntity>
    findTop8ByOrderByRiskScoreDescCreatedAtDesc();
}
