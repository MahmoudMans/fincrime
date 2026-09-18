CREATE TABLE investigation_triage_runs (
    id UUID PRIMARY KEY,

    calculated_by VARCHAR(180) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL,

    case_count INTEGER NOT NULL,

    urgent_count INTEGER NOT NULL,
    high_count INTEGER NOT NULL,
    medium_count INTEGER NOT NULL,
    routine_count INTEGER NOT NULL,

    CONSTRAINT chk_triage_run_case_count
        CHECK (case_count >= 0),

    CONSTRAINT chk_triage_run_band_counts
        CHECK (
            urgent_count >= 0
            AND high_count >= 0
            AND medium_count >= 0
            AND routine_count >= 0
        )
);

CREATE TABLE investigation_triage_snapshots (
    id UUID PRIMARY KEY,

    run_id UUID NOT NULL,
    case_id UUID NOT NULL,

    case_number VARCHAR(120) NOT NULL,
    case_priority VARCHAR(20) NOT NULL,
    case_status VARCHAR(40) NOT NULL,

    triage_score INTEGER NOT NULL,
    triage_band VARCHAR(20) NOT NULL,

    priority_points INTEGER NOT NULL,
    sla_points INTEGER NOT NULL,
    age_points INTEGER NOT NULL,
    status_points INTEGER NOT NULL,

    explanation VARCHAR(2000) NOT NULL,

    calculated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_triage_snapshot_run
        FOREIGN KEY (run_id)
        REFERENCES investigation_triage_runs(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_triage_snapshot_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_triage_snapshot_case_run
        UNIQUE (
            run_id,
            case_id
        ),

    CONSTRAINT chk_triage_score
        CHECK (
            triage_score BETWEEN 0 AND 100
        )
);

CREATE TABLE case_queue_ownership (
    case_id UUID PRIMARY KEY,

    owner_username VARCHAR(180) NOT NULL,
    assigned_by VARCHAR(180) NOT NULL,
    assignment_note VARCHAR(1000) NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_queue_owner_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_triage_runs_calculated_at
    ON investigation_triage_runs(
        calculated_at DESC
    );

CREATE INDEX idx_triage_snapshot_run_score
    ON investigation_triage_snapshots(
        run_id,
        triage_score DESC
    );

CREATE INDEX idx_triage_snapshot_case
    ON investigation_triage_snapshots(
        case_id,
        calculated_at DESC
    );

CREATE INDEX idx_case_queue_owner_username
    ON case_queue_ownership(
        owner_username
    );
