CREATE TABLE investigation_evidence_registry (
    id UUID PRIMARY KEY,

    case_id UUID NOT NULL,

    evidence_reference VARCHAR(160) NOT NULL,
    evidence_type VARCHAR(80) NOT NULL,
    title VARCHAR(240) NOT NULL,
    source_reference VARCHAR(600) NOT NULL,
    description VARCHAR(2000) NOT NULL,

    content_sha256 CHAR(64) NOT NULL,
    registry_fingerprint CHAR(64) NOT NULL,

    current_custodian VARCHAR(180) NOT NULL,
    current_status VARCHAR(40) NOT NULL,

    registered_by VARCHAR(180) NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_evidence_registry_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_evidence_registry_reference
        UNIQUE (
            case_id,
            evidence_reference
        ),

    CONSTRAINT chk_evidence_content_sha256
        CHECK (
            content_sha256 ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_evidence_registry_fingerprint
        CHECK (
            registry_fingerprint ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_evidence_registry_status
        CHECK (
            current_status IN (
                'REGISTERED',
                'TRANSFERRED',
                'VERIFIED',
                'INTEGRITY_ALERT'
            )
        )
);

CREATE TABLE investigation_evidence_custody_events (
    id UUID PRIMARY KEY,

    evidence_id UUID NOT NULL,

    sequence_number INTEGER NOT NULL,

    event_type VARCHAR(40) NOT NULL,

    from_custodian VARCHAR(180),
    to_custodian VARCHAR(180),

    actor_username VARCHAR(180) NOT NULL,
    event_note VARCHAR(2000) NOT NULL,

    previous_event_hash CHAR(64) NOT NULL,
    event_hash CHAR(64) NOT NULL,

    occurred_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_evidence_custody_event
        FOREIGN KEY (evidence_id)
        REFERENCES investigation_evidence_registry(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_evidence_custody_sequence
        UNIQUE (
            evidence_id,
            sequence_number
        ),

    CONSTRAINT chk_evidence_custody_sequence
        CHECK (
            sequence_number > 0
        ),

    CONSTRAINT chk_evidence_custody_event_type
        CHECK (
            event_type IN (
                'REGISTERED',
                'TRANSFERRED',
                'VERIFIED'
            )
        ),

    CONSTRAINT chk_evidence_custody_previous_hash
        CHECK (
            previous_event_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_evidence_custody_event_hash
        CHECK (
            event_hash ~ '^[0-9a-f]{64}$'
        )
);

CREATE INDEX idx_evidence_registry_case
    ON investigation_evidence_registry(
        case_id,
        registered_at DESC
    );

CREATE INDEX idx_evidence_registry_custodian
    ON investigation_evidence_registry(
        current_custodian,
        current_status
    );

CREATE INDEX idx_evidence_custody_evidence
    ON investigation_evidence_custody_events(
        evidence_id,
        sequence_number
    );
