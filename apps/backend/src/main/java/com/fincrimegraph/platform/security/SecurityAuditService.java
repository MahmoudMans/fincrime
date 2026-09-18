package com.fincrimegraph.platform.security;

import com.fincrimegraph.platform.domain.SecurityAuditEventEntity;
import com.fincrimegraph.platform.repository.SecurityAuditEventRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SecurityAuditService {

    private final SecurityAuditEventRepository repository;

    public SecurityAuditService(
            SecurityAuditEventRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public void record(
            String username,
            String action,
            String resourceType,
            String resourceId,
            String outcome,
            String detail
    ) {
        repository.save(
                new SecurityAuditEventEntity(
                        UUID.randomUUID(),
                        safe(
                                username,
                                "anonymous"
                        ),
                        safe(
                                action,
                                "UNKNOWN"
                        ),
                        safe(
                                resourceType,
                                "UNKNOWN"
                        ),
                        resourceId,
                        safe(
                                outcome,
                                "SUCCESS"
                        ),
                        safe(
                                detail,
                                ""
                        ),
                        Instant.now()
                )
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<AuditView> recent() {
        return repository
                .findTop100ByOrderByOccurredAtDesc()
                .stream()
                .map(
                        item ->
                                new AuditView(
                                        item
                                                .getId()
                                                .toString(),
                                        item
                                                .getUsername(),
                                        item
                                                .getAction(),
                                        item
                                                .getResourceType(),
                                        item
                                                .getResourceId(),
                                        item
                                                .getOutcome(),
                                        item
                                                .getDetail(),
                                        item
                                                .getOccurredAt()
                                )
                )
                .toList();
    }

    private String safe(
            String value,
            String fallback
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return fallback;
        }

        return value.length() <= 2000
                ? value
                : value.substring(
                        0,
                        2000
                );
    }

    public record AuditView(
            String id,
            String username,
            String action,
            String resourceType,
            String resourceId,
            String outcome,
            String detail,
            Instant occurredAt
    ) {
    }
}
