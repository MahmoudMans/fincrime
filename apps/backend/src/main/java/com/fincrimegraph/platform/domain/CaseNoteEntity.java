package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "case_notes")
public class CaseNoteEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(
            name = "case_id",
            nullable = false
    )
    private InvestigationCaseEntity investigationCase;

    @Column(
            name = "author_name",
            nullable = false,
            length = 160
    )
    private String authorName;

    @Column(
            nullable = false,
            length = 2000
    )
    private String body;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected CaseNoteEntity() {
    }

    public CaseNoteEntity(
            UUID id,
            InvestigationCaseEntity investigationCase,
            String authorName,
            String body,
            Instant createdAt
    ) {
        this.id = id;
        this.investigationCase = investigationCase;
        this.authorName = authorName;
        this.body = body;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public InvestigationCaseEntity getInvestigationCase() {
        return investigationCase;
    }

    public String getAuthorName() {
        return authorName;
    }

    public String getBody() {
        return body;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
