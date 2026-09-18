package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.SecurityAuditEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SecurityAuditEventRepository
        extends JpaRepository<SecurityAuditEventEntity, UUID> {

    List<SecurityAuditEventEntity>
    findTop100ByOrderByOccurredAtDesc();
}
