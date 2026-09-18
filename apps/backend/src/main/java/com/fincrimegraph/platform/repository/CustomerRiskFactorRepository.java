package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.CustomerRiskFactorEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CustomerRiskFactorRepository
        extends JpaRepository<CustomerRiskFactorEntity, UUID> {

    List<CustomerRiskFactorEntity>
    findByAssessment_IdOrderByContributionDescFactorKeyAsc(
            UUID assessmentId
    );
}
