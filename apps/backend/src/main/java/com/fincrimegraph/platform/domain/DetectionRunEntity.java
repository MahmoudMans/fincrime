package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "detection_runs")
public class DetectionRunEntity {

    public enum DetectionRunStatus {
        RUNNING,
        COMPLETED,
        FAILED
    }

    @Id
    private UUID id;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DetectionRunStatus status;

    @Column(name = "rules_executed", nullable = false)
    private int rulesExecuted;

    @Column(name = "candidates_found", nullable = false)
    private int candidatesFound;

    @Column(name = "alerts_created", nullable = false)
    private int alertsCreated;

    @Column(name = "alerts_existing", nullable = false)
    private int alertsExisting;

    protected DetectionRunEntity() {
    }

    public DetectionRunEntity(
            UUID id,
            Instant startedAt
    ) {
        this.id = id;
        this.startedAt = startedAt;
        this.status = DetectionRunStatus.RUNNING;
        this.rulesExecuted = 0;
        this.candidatesFound = 0;
        this.alertsCreated = 0;
        this.alertsExisting = 0;
    }

    public void complete(
            Instant completedAt,
            int rulesExecuted,
            int candidatesFound,
            int alertsCreated,
            int alertsExisting
    ) {
        this.completedAt = completedAt;
        this.status = DetectionRunStatus.COMPLETED;
        this.rulesExecuted = rulesExecuted;
        this.candidatesFound = candidatesFound;
        this.alertsCreated = alertsCreated;
        this.alertsExisting = alertsExisting;
    }

    public UUID getId() {
        return id;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public DetectionRunStatus getStatus() {
        return status;
    }

    public int getRulesExecuted() {
        return rulesExecuted;
    }

    public int getCandidatesFound() {
        return candidatesFound;
    }

    public int getAlertsCreated() {
        return alertsCreated;
    }

    public int getAlertsExisting() {
        return alertsExisting;
    }
}
