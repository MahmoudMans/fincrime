package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.CustomerRiskAssessmentEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomerRiskAssessmentRepository
        extends JpaRepository<CustomerRiskAssessmentEntity, UUID> {

    @EntityGraph(
            attributePaths = "customer"
    )
    List<CustomerRiskAssessmentEntity>
    findAllByOrderByGeneratedAtDesc();

    @EntityGraph(
            attributePaths = "customer"
    )
    List<CustomerRiskAssessmentEntity>
    findByBatchIdOrderByScoreDescCustomer_FullNameAsc(
            UUID batchId
    );

    @EntityGraph(
            attributePaths = "customer"
    )
    List<CustomerRiskAssessmentEntity>
    findByCustomer_IdOrderByGeneratedAtDesc(
            UUID customerId
    );
}
