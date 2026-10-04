package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "data_import_row_issues")
public class DataImportRowIssueEntity {

    @Id
    private UUID id;

    @Column(
            name = "job_id",
            nullable = false
    )
    private UUID jobId;

    @Column(
            name = "row_number",
            nullable = false
    )
    private int rowNumber;

    @Column(
            nullable = false,
            length = 32
    )
    private String classification;

    @Column(
            name = "field_name",
            length = 100
    )
    private String fieldName;

    @Column(
            name = "issue_code",
            nullable = false,
            length = 80
    )
    private String issueCode;

    @Column(
            nullable = false,
            length = 1000
    )
    private String message;

    @Column(
            name = "row_json",
            nullable = false,
            columnDefinition = "text"
    )
    private String rowJson;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected DataImportRowIssueEntity() {
    }

    public DataImportRowIssueEntity(
            UUID id,
            UUID jobId,
            int rowNumber,
            String classification,
            String fieldName,
            String issueCode,
            String message,
            String rowJson,
            Instant createdAt
    ) {
        this.id = id;
        this.jobId = jobId;
        this.rowNumber = rowNumber;
        this.classification = classification;
        this.fieldName = fieldName;
        this.issueCode = issueCode;
        this.message = message;
        this.rowJson = rowJson;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getJobId() {
        return jobId;
    }

    public int getRowNumber() {
        return rowNumber;
    }

    public String getClassification() {
        return classification;
    }

    public String getFieldName() {
        return fieldName;
    }

    public String getIssueCode() {
        return issueCode;
    }

    public String getMessage() {
        return message;
    }

    public String getRowJson() {
        return rowJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
