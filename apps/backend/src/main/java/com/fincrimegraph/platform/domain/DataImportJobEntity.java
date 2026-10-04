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
@Table(name = "data_import_jobs")
public class DataImportJobEntity {

    public enum DatasetType {
        CUSTOMERS,
        ACCOUNTS,
        TRANSACTIONS
    }

    public enum ImportStatus {
        UPLOADED,
        VALIDATED,
        READY,
        IMPORTED,
        FAILED
    }

    public enum GraphSyncStatus {
        PENDING,
        SYNCHRONIZED,
        FAILED
    }

    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "dataset_type",
            nullable = false,
            length = 32
    )
    private DatasetType datasetType;

    @Column(
            name = "file_name",
            nullable = false,
            length = 255
    )
    private String fileName;

    @Column(
            name = "media_type",
            length = 120
    )
    private String mediaType;

    @Column(
            name = "file_size",
            nullable = false
    )
    private long fileSize;

    @Column(
            nullable = false,
            length = 64
    )
    private String sha256;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 32
    )
    private ImportStatus status;

    @Column(
            name = "total_rows",
            nullable = false
    )
    private int totalRows;

    @Column(
            name = "valid_rows",
            nullable = false
    )
    private int validRows;

    @Column(
            name = "duplicate_rows",
            nullable = false
    )
    private int duplicateRows;

    @Column(
            name = "invalid_rows",
            nullable = false
    )
    private int invalidRows;

    @Column(
            name = "imported_rows",
            nullable = false
    )
    private int importedRows;

    @Column(
            name = "payload_json",
            nullable = false,
            columnDefinition = "text"
    )
    private String payloadJson;

    @Column(
            name = "created_by",
            nullable = false,
            length = 200
    )
    private String createdBy;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    @Column(
            name = "validated_at"
    )
    private Instant validatedAt;

    @Column(
            name = "imported_at"
    )
    private Instant importedAt;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "graph_sync_status",
            nullable = false,
            length = 32
    )
    private GraphSyncStatus graphSyncStatus;

    @Column(
            name = "graph_sync_error",
            length = 1000
    )
    private String graphSyncError;

    @Column(
            name = "failure_message",
            length = 1000
    )
    private String failureMessage;

    protected DataImportJobEntity() {
    }

    public DataImportJobEntity(
            UUID id,
            DatasetType datasetType,
            String fileName,
            String mediaType,
            long fileSize,
            String sha256,
            String payloadJson,
            String createdBy,
            Instant createdAt
    ) {
        this.id = id;
        this.datasetType = datasetType;
        this.fileName = fileName;
        this.mediaType = mediaType;
        this.fileSize = fileSize;
        this.sha256 = sha256;
        this.status = ImportStatus.UPLOADED;
        this.payloadJson = payloadJson;
        this.createdBy = createdBy;
        this.createdAt = createdAt;

        this.totalRows = 0;
        this.validRows = 0;
        this.duplicateRows = 0;
        this.invalidRows = 0;
        this.importedRows = 0;

        this.graphSyncStatus =
                GraphSyncStatus.PENDING;
    }

    public void applyValidation(
            ImportStatus nextStatus,
            int totalRows,
            int validRows,
            int duplicateRows,
            int invalidRows,
            String payloadJson,
            Instant validatedAt
    ) {
        this.status = nextStatus;
        this.totalRows = totalRows;
        this.validRows = validRows;
        this.duplicateRows = duplicateRows;
        this.invalidRows = invalidRows;
        this.payloadJson = payloadJson;
        this.validatedAt = validatedAt;
        this.failureMessage = null;
    }

    public void markImported(
            int importedRows,
            Instant importedAt
    ) {
        this.status = ImportStatus.IMPORTED;
        this.importedRows = importedRows;
        this.importedAt = importedAt;
        this.failureMessage = null;
        this.graphSyncStatus =
                GraphSyncStatus.PENDING;
        this.graphSyncError = null;
    }

    public void markFailed(
            String failureMessage
    ) {
        this.status = ImportStatus.FAILED;
        this.failureMessage = failureMessage;
    }

    public void markGraphSynchronized() {
        this.graphSyncStatus =
                GraphSyncStatus.SYNCHRONIZED;
        this.graphSyncError = null;
    }

    public void markGraphFailed(
            String message
    ) {
        this.graphSyncStatus =
                GraphSyncStatus.FAILED;
        this.graphSyncError = message;
    }

    public UUID getId() {
        return id;
    }

    public DatasetType getDatasetType() {
        return datasetType;
    }

    public String getFileName() {
        return fileName;
    }

    public String getMediaType() {
        return mediaType;
    }

    public long getFileSize() {
        return fileSize;
    }

    public String getSha256() {
        return sha256;
    }

    public ImportStatus getStatus() {
        return status;
    }

    public int getTotalRows() {
        return totalRows;
    }

    public int getValidRows() {
        return validRows;
    }

    public int getDuplicateRows() {
        return duplicateRows;
    }

    public int getInvalidRows() {
        return invalidRows;
    }

    public int getImportedRows() {
        return importedRows;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getValidatedAt() {
        return validatedAt;
    }

    public Instant getImportedAt() {
        return importedAt;
    }

    public GraphSyncStatus getGraphSyncStatus() {
        return graphSyncStatus;
    }

    public String getGraphSyncError() {
        return graphSyncError;
    }

    public String getFailureMessage() {
        return failureMessage;
    }
}
