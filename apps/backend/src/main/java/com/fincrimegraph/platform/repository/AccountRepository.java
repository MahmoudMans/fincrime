package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.AccountEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AccountRepository
        extends JpaRepository<AccountEntity, UUID> {

    @Override
    @EntityGraph(attributePaths = "customer")
    List<AccountEntity> findAll();

    @Override
    @EntityGraph(attributePaths = "customer")
    Optional<AccountEntity> findById(UUID id);

    @EntityGraph(attributePaths = "customer")
    Optional<AccountEntity> findByAccountNumber(
            String accountNumber
    );
}
