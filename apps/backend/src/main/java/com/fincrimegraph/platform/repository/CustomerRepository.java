package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.CustomerEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface CustomerRepository extends JpaRepository<CustomerEntity, UUID> {

    long countByRiskTier(CustomerEntity.RiskTier riskTier);
}
