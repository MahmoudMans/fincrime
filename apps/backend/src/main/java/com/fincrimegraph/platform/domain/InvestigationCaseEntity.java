package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "investigation_cases")
public class InvestigationCaseEntity {

    public enum CaseStatus {
        OPEN,
        IN_REVIEW,
        CLOSED
    }

    public enum CasePriority {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    @Id
    private UUID id;

    @Column(
            name = "case_number",
            nullable = false,
            unique = true,
            length = 96
    )
    private String caseNumber;

    @Column(nullable = false, length = 220)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CaseStatus status;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private CasePriority priority;

    @Column(nullable = false, length = 2000)
    private String summary;

    @Column(name = "assigned_to", length = 160)
    private String assignedTo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "primary_alert_id",
            nullable = false,
            unique = true
    )
    private AlertEntity primaryAlert;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected InvestigationCaseEntity() {
    }

    public InvestigationCaseEntity(
            UUID id,
            String caseNumber,
            String title,
            CaseStatus status,
            CasePriority priority,
            String summary,
            String assignedTo,
            AlertEntity primaryAlert,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.caseNumber = caseNumber;
        this.title = title;
        this.status = status;
        this.priority = priority;
        this.summary = summary;
        this.assignedTo = assignedTo;
        this.primaryAlert = primaryAlert;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public void advance(Instant now) {
        this.status = switch (this.status) {
            case OPEN -> CaseStatus.IN_REVIEW;
            case IN_REVIEW -> CaseStatus.CLOSED;
            case CLOSED -> CaseStatus.CLOSED;
        };

        this.updatedAt = now;
    }

    public UUID getId() {
        return id;
    }

    public String getCaseNumber() {
        return caseNumber;
    }

    public String getTitle() {
        return title;
    }

    public CaseStatus getStatus() {
        return status;
    }

    public CasePriority getPriority() {
        return priority;
    }

    public String getSummary() {
        return summary;
    }

    public String getAssignedTo() {
        return assignedTo;
    }

    public AlertEntity getPrimaryAlert() {
        return primaryAlert;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
