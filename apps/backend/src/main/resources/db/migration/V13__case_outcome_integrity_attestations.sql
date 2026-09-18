CREATE TABLE case_outcome_attestations (
    id UUID PRIMARY KEY,

    case_id UUID NOT NULL,
    execution_id UUID NOT NULL UNIQUE,
    proposal_id UUID NOT NULL,

    decision_version INTEGER NOT NULL,
    governed_outcome VARCHAR(60) NOT NULL,

    provenance_hash CHAR(64) NOT NULL,
    audit_root_hash CHAR(64) NOT NULL,

    attested_by VARCHAR(180) NOT NULL,
    attested_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_outcome_attestation_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id),

    CONSTRAINT fk_outcome_attestation_execution
        FOREIGN KEY (execution_id)
        REFERENCES case_decision_executions(id),

    CONSTRAINT fk_outcome_attestation_proposal
        FOREIGN KEY (proposal_id)
        REFERENCES case_decision_proposals(id),

    CONSTRAINT chk_outcome_attestation_version
        CHECK (decision_version > 0),

    CONSTRAINT chk_outcome_attestation_hash
        CHECK (
            provenance_hash ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_outcome_attestation_audit_root
        CHECK (
            audit_root_hash ~ '^[0-9a-f]{64}$'
        )
);

CREATE TABLE case_outcome_attestation_verifications (
    id UUID PRIMARY KEY,

    attestation_id UUID NOT NULL,

    provenance_valid BOOLEAN NOT NULL,
    audit_anchor_present BOOLEAN NOT NULL,
    integrity_valid BOOLEAN NOT NULL,

    detail VARCHAR(2000) NOT NULL,

    verified_by VARCHAR(180) NOT NULL,
    verified_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_outcome_attestation_verification
        FOREIGN KEY (attestation_id)
        REFERENCES case_outcome_attestations(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_outcome_attestation_case
    ON case_outcome_attestations(
        case_id,
        attested_at DESC
    );

CREATE INDEX idx_outcome_attestation_verification
    ON case_outcome_attestation_verifications(
        attestation_id,
        verified_at DESC
    );
