package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.SecurityAuditEventEntity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface SecurityAuditEventRepository
        extends JpaRepository<SecurityAuditEventEntity, UUID> {

    List<SecurityAuditEventEntity>
    findTop100ByOrderByOccurredAtDesc();

    List<SecurityAuditEventEntity>
    findByOccurredAtBetweenOrderByOccurredAtDesc(
            Instant from,
            Instant to,
            Pageable pageable
    );

    long countByOccurredAtBetween(
            Instant from,
            Instant to
    );
}
