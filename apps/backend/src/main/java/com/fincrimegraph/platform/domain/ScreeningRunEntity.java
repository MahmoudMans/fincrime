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
@Table(name = "screening_runs")
public class ScreeningRunEntity {

    public enum ScreeningStatus {
        RUNNING,
        COMPLETED
    }

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 30
    )
    private ScreeningStatus status;

    @Column(
            name = "customers_scanned",
            nullable = false
    )
    private int customersScanned;

    @Column(
            name = "entries_scanned",
            nullable = false
    )
    private int entriesScanned;

    @Column(
            name = "hits_found",
            nullable = false
    )
    private int hitsFound;

    @Column(
            name = "triggered_by",
            nullable = false,
            length = 180
    )
    private String triggeredBy;

    @Column(
            name = "started_at",
            nullable = false
    )
    private Instant startedAt;

    @Column(
            name = "completed_at"
    )
    private Instant completedAt;

    protected ScreeningRunEntity() {
    }

    public ScreeningRunEntity(
            UUID id,
            int customersScanned,
            int entriesScanned,
            String triggeredBy,
            Instant startedAt
    ) {
        this.id = id;
        this.status =
                ScreeningStatus.RUNNING;
        this.customersScanned =
                customersScanned;
        this.entriesScanned =
                entriesScanned;
        this.hitsFound = 0;
        this.triggeredBy =
                triggeredBy;
        this.startedAt =
                startedAt;
        this.completedAt =
                null;
    }

    public void complete(
            int hitsFound,
            Instant completedAt
    ) {
        this.status =
                ScreeningStatus.COMPLETED;
        this.hitsFound =
                hitsFound;
        this.completedAt =
                completedAt;
    }

    public UUID getId() {
        return id;
    }

    public ScreeningStatus getStatus() {
        return status;
    }

    public int getCustomersScanned() {
        return customersScanned;
    }

    public int getEntriesScanned() {
        return entriesScanned;
    }

    public int getHitsFound() {
        return hitsFound;
    }

    public String getTriggeredBy() {
        return triggeredBy;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
