package com.fincrimegraph.platform.security;

import com.fincrimegraph.platform.domain.SecurityAuditEventEntity;
import com.fincrimegraph.platform.repository.SecurityAuditEventRepository;
import org.springframework.data.domain.PageRequest;
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
                                "anonymous",
                                180
                        ),
                        safe(
                                action,
                                "UNKNOWN",
                                80
                        ),
                        safe(
                                resourceType,
                                "UNKNOWN",
                                80
                        ),
                        clip(
                                resourceId,
                                180
                        ),
                        safe(
                                outcome,
                                "SUCCESS",
                                30
                        ),
                        safe(
                                detail,
                                "",
                                2000
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
                .map(SecurityAuditService::toView)
                .toList();
    }

    /**
     * One page of events inside a time range, newest first, plus the
     * number of events the whole range holds.
     */
    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public AuditPageView search(
            AuditRange range
    ) {
        List<AuditView> items =
                repository
                        .findByOccurredAtBetweenOrderByOccurredAtDesc(
                                range.from(),
                                range.to(),
                                PageRequest.of(
                                        range.page(),
                                        range.size()
                                )
                        )
                        .stream()
                        .map(SecurityAuditService::toView)
                        .toList();

        long total =
                repository
                        .countByOccurredAtBetween(
                                range.from(),
                                range.to()
                        );

        return new AuditPageView(
                items,
                total,
                range.page(),
                range.size()
        );
    }

    private static AuditView toView(
            SecurityAuditEventEntity item
    ) {
        return new AuditView(
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
        );
    }

    /** Text that fits a database column; blank text gets the fallback. */
    static String safe(
            String value,
            String fallback,
            int maximumLength
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return fallback;
        }

        return clip(
                value,
                maximumLength
        );
    }

    static String clip(
            String value,
            int maximumLength
    ) {
        if (
                value == null
                        || value.length() <= maximumLength
        ) {
            return value;
        }

        return value.substring(
                0,
                maximumLength
        );
    }

    public record AuditPageView(
            List<AuditView> items,
            long total,
            int page,
            int size
    ) {
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
