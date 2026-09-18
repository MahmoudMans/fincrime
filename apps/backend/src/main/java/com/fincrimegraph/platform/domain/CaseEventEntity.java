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
@Table(name = "case_events")
public class CaseEventEntity {

    public enum EventType {
        NOTE_ADDED,
        EVIDENCE_ATTACHED,
        ASSIGNEE_CHANGED,
        CASE_RESOLVED
    }

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "case_id",
            nullable = false
    )
    private InvestigationCaseEntity investigationCase;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "event_type",
            nullable = false,
            length = 50
    )
    private EventType eventType;

    @Column(
            nullable = false,
            length = 2000
    )
    private String description;

    @Column(
            name = "actor_name",
            nullable = false,
            length = 160
    )
    private String actorName;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected CaseEventEntity() {
    }

    public CaseEventEntity(
            UUID id,
            InvestigationCaseEntity investigationCase,
            EventType eventType,
            String description,
            String actorName,
            Instant createdAt
    ) {
        this.id = id;
        this.investigationCase = investigationCase;
        this.eventType = eventType;
        this.description = description;
        this.actorName = actorName;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public InvestigationCaseEntity getInvestigationCase() {
        return investigationCase;
    }

    public EventType getEventType() {
        return eventType;
    }

    public String getDescription() {
        return description;
    }

    public String getActorName() {
        return actorName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
