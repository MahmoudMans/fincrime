package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.TransactionEntity;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TransactionRepository
        extends JpaRepository<TransactionEntity, UUID> {

    @EntityGraph(attributePaths = {
            "sourceAccount",
            "sourceAccount.customer",
            "destinationAccount",
            "destinationAccount.customer"
    })
    List<TransactionEntity> findTop10ByOrderByOccurredAtDesc();

    @Override
    @EntityGraph(attributePaths = {
            "sourceAccount",
            "sourceAccount.customer",
            "destinationAccount",
            "destinationAccount.customer"
    })
    List<TransactionEntity> findAll();

    @EntityGraph(attributePaths = {
            "sourceAccount",
            "sourceAccount.customer",
            "destinationAccount",
            "destinationAccount.customer"
    })
    Optional<TransactionEntity> findByReference(
            String reference
    );

    @Query("select coalesce(sum(t.amount), 0) from TransactionEntity t")
    BigDecimal totalTransactionVolume();
}
