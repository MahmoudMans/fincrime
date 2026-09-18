CREATE TABLE detection_runs (
    id UUID PRIMARY KEY,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL,
    rules_executed INTEGER NOT NULL DEFAULT 0,
    candidates_found INTEGER NOT NULL DEFAULT 0,
    alerts_created INTEGER NOT NULL DEFAULT 0,
    alerts_existing INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE investigation_cases (
    id UUID PRIMARY KEY,
    case_number VARCHAR(96) NOT NULL UNIQUE,
    title VARCHAR(220) NOT NULL,
    status VARCHAR(32) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    summary VARCHAR(2000) NOT NULL,
    assigned_to VARCHAR(160),
    primary_alert_id UUID NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_investigation_case_alert
        FOREIGN KEY (primary_alert_id)
        REFERENCES alerts(id)
);

CREATE INDEX idx_detection_runs_started_at
    ON detection_runs(started_at DESC);

CREATE INDEX idx_detection_runs_status
    ON detection_runs(status);

CREATE INDEX idx_cases_status
    ON investigation_cases(status);

CREATE INDEX idx_cases_priority
    ON investigation_cases(priority);

CREATE INDEX idx_cases_updated_at
    ON investigation_cases(updated_at DESC);
