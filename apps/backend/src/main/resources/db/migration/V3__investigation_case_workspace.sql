ALTER TABLE investigation_cases
    ADD COLUMN disposition VARCHAR(40),
    ADD COLUMN resolution_summary VARCHAR(2000),
    ADD COLUMN closed_at TIMESTAMPTZ;

CREATE TABLE case_notes (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL,
    author_name VARCHAR(160) NOT NULL,
    body VARCHAR(2000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_notes_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE
);

CREATE TABLE case_evidence (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL,
    evidence_type VARCHAR(40) NOT NULL,
    reference_type VARCHAR(40) NOT NULL,
    reference_id VARCHAR(160) NOT NULL,
    title VARCHAR(240) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    snapshot_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_evidence_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE
);

CREATE TABLE case_events (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    actor_name VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_events_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_case_notes_case_created
    ON case_notes(case_id, created_at);

CREATE INDEX idx_case_evidence_case_created
    ON case_evidence(case_id, created_at);

CREATE INDEX idx_case_evidence_reference
    ON case_evidence(reference_type, reference_id);

CREATE INDEX idx_case_events_case_created
    ON case_events(case_id, created_at);
