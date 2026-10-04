CREATE TABLE data_import_jobs (
    id UUID PRIMARY KEY,

    dataset_type VARCHAR(32) NOT NULL,

    file_name VARCHAR(255) NOT NULL,
    media_type VARCHAR(120),
    file_size BIGINT NOT NULL,

    sha256 VARCHAR(64) NOT NULL,

    status VARCHAR(32) NOT NULL,

    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    imported_rows INTEGER NOT NULL DEFAULT 0,

    payload_json TEXT NOT NULL,

    created_by VARCHAR(200) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    validated_at TIMESTAMPTZ,
    imported_at TIMESTAMPTZ,

    graph_sync_status VARCHAR(32) NOT NULL,
    graph_sync_error VARCHAR(1000),

    failure_message VARCHAR(1000)
);

CREATE INDEX idx_data_import_jobs_created_at
    ON data_import_jobs(created_at DESC);

CREATE INDEX idx_data_import_jobs_status
    ON data_import_jobs(status);

CREATE INDEX idx_data_import_jobs_sha256
    ON data_import_jobs(sha256);

CREATE TABLE data_import_row_issues (
    id UUID PRIMARY KEY,

    job_id UUID NOT NULL,

    row_number INTEGER NOT NULL,

    classification VARCHAR(32) NOT NULL,

    field_name VARCHAR(100),

    issue_code VARCHAR(80) NOT NULL,
    message VARCHAR(1000) NOT NULL,

    row_json TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_data_import_issue_job
        FOREIGN KEY (job_id)
        REFERENCES data_import_jobs(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_data_import_issues_job
    ON data_import_row_issues(job_id, row_number);
