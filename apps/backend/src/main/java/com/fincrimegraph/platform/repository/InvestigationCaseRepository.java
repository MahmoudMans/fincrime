package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.InvestigationCaseEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InvestigationCaseRepository
        extends JpaRepository<InvestigationCaseEntity, UUID> {

    @EntityGraph(attributePaths = {
            "primaryAlert"
    })
    List<InvestigationCaseEntity>
    findAllByOrderByUpdatedAtDesc();

    @EntityGraph(attributePaths = {
            "primaryAlert"
    })
    Optional<InvestigationCaseEntity>
    findByPrimaryAlert_Id(
            UUID primaryAlertId
    );

    @Override
    @EntityGraph(attributePaths = {
            "primaryAlert",
            "primaryAlert.primaryAccount",
            "primaryAlert.primaryAccount.customer",
            "primaryAlert.transaction"
    })
    Optional<InvestigationCaseEntity>
    findById(UUID id);
}
