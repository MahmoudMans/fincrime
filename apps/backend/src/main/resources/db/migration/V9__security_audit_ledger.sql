CREATE TABLE security_audit_ledger_entries (
    sequence_number BIGSERIAL PRIMARY KEY,

    audit_event_id UUID NOT NULL UNIQUE,

    event_hash CHAR(64) NOT NULL,
    previous_chain_hash CHAR(64) NOT NULL,
    chain_hash CHAR(64) NOT NULL,

    event_occurred_at TIMESTAMPTZ NOT NULL,
    chained_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_audit_ledger_event
        FOREIGN KEY (audit_event_id)
        REFERENCES security_audit_events(id),

    CONSTRAINT chk_audit_ledger_event_hash
        CHECK (
            event_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_audit_ledger_previous_hash
        CHECK (
            previous_chain_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_audit_ledger_chain_hash
        CHECK (
            chain_hash ~ '^[0-9a-f]{64}$'
        )
);

CREATE TABLE security_audit_ledger_verifications (
    id UUID PRIMARY KEY,

    verified_at TIMESTAMPTZ NOT NULL,

    source_event_count BIGINT NOT NULL,
    ledger_entry_count BIGINT NOT NULL,
    uncovered_event_count BIGINT NOT NULL,
    appended_count BIGINT NOT NULL,

    chain_valid BOOLEAN NOT NULL,
    complete BOOLEAN NOT NULL,
    integrity_valid BOOLEAN NOT NULL,

    root_hash CHAR(64) NOT NULL,
    detail VARCHAR(2000) NOT NULL,

    CONSTRAINT chk_audit_verification_source_count
        CHECK (
            source_event_count >= 0
        ),

    CONSTRAINT chk_audit_verification_ledger_count
        CHECK (
            ledger_entry_count >= 0
        ),

    CONSTRAINT chk_audit_verification_uncovered_count
        CHECK (
            uncovered_event_count >= 0
        ),

    CONSTRAINT chk_audit_verification_appended_count
        CHECK (
            appended_count >= 0
        ),

    CONSTRAINT chk_audit_verification_root_hash
        CHECK (
            root_hash ~ '^[0-9a-f]{64}$'
        )
);

CREATE INDEX idx_audit_ledger_event
    ON security_audit_ledger_entries(
        audit_event_id
    );

CREATE INDEX idx_audit_ledger_occurred
    ON security_audit_ledger_entries(
        event_occurred_at
    );

CREATE INDEX idx_audit_ledger_verification_time
    ON security_audit_ledger_verifications(
        verified_at DESC
    );
