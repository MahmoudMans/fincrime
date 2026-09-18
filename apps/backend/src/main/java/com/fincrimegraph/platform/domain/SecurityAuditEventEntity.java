package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "security_audit_events")
public class SecurityAuditEventEntity {

    @Id
    private UUID id;

    @Column(
            nullable = false,
            length = 180
    )
    private String username;

    @Column(
            nullable = false,
            length = 80
    )
    private String action;

    @Column(
            name = "resource_type",
            nullable = false,
            length = 80
    )
    private String resourceType;

    @Column(
            name = "resource_id",
            length = 180
    )
    private String resourceId;

    @Column(
            nullable = false,
            length = 30
    )
    private String outcome;

    @Column(
            nullable = false,
            length = 2000
    )
    private String detail;

    @Column(
            name = "occurred_at",
            nullable = false
    )
    private Instant occurredAt;

    protected SecurityAuditEventEntity() {
    }

    public SecurityAuditEventEntity(
            UUID id,
            String username,
            String action,
            String resourceType,
            String resourceId,
            String outcome,
            String detail,
            Instant occurredAt
    ) {
        this.id = id;
        this.username = username;
        this.action = action;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.outcome = outcome;
        this.detail = detail;
        this.occurredAt = occurredAt;
    }

    public UUID getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getAction() {
        return action;
    }

    public String getResourceType() {
        return resourceType;
    }

    public String getResourceId() {
        return resourceId;
    }

    public String getOutcome() {
        return outcome;
    }

    public String getDetail() {
        return detail;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }
}
