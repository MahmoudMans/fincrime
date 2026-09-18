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
@Table(name = "case_evidence")
public class CaseEvidenceEntity {

    public enum EvidenceType {
        ALERT,
        TRANSACTION,
        GRAPH_CYCLE
    }

    public enum ReferenceType {
        ALERT,
        TRANSACTION,
        GRAPH
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
            name = "evidence_type",
            nullable = false,
            length = 40
    )
    private EvidenceType evidenceType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "reference_type",
            nullable = false,
            length = 40
    )
    private ReferenceType referenceType;

    @Column(
            name = "reference_id",
            nullable = false,
            length = 160
    )
    private String referenceId;

    @Column(
            nullable = false,
            length = 240
    )
    private String title;

    @Column(
            nullable = false,
            length = 2000
    )
    private String description;

    @Column(
            name = "snapshot_text",
            nullable = false,
            columnDefinition = "text"
    )
    private String snapshotText;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected CaseEvidenceEntity() {
    }

    public CaseEvidenceEntity(
            UUID id,
            InvestigationCaseEntity investigationCase,
            EvidenceType evidenceType,
            ReferenceType referenceType,
            String referenceId,
            String title,
            String description,
            String snapshotText,
            Instant createdAt
    ) {
        this.id = id;
        this.investigationCase = investigationCase;
        this.evidenceType = evidenceType;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.title = title;
        this.description = description;
        this.snapshotText = snapshotText;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public InvestigationCaseEntity getInvestigationCase() {
        return investigationCase;
    }

    public EvidenceType getEvidenceType() {
        return evidenceType;
    }

    public ReferenceType getReferenceType() {
        return referenceType;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getSnapshotText() {
        return snapshotText;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
