CREATE TABLE investigation_conclusion_packages (
    id UUID PRIMARY KEY,

    case_id UUID NOT NULL,
    package_version INTEGER NOT NULL,

    finding_id UUID NOT NULL,
    finding_version INTEGER NOT NULL,
    finding_reference VARCHAR(160) NOT NULL,
    finding_title VARCHAR(240) NOT NULL,
    finding_narrative VARCHAR(4000) NOT NULL,

    finding_review_id UUID NOT NULL,
    finding_reviewed_by VARCHAR(180) NOT NULL,

    evidence_id UUID NOT NULL,
    evidence_review_id UUID NOT NULL,
    evidence_review_version INTEGER NOT NULL,
    evidence_registry_fingerprint CHAR(64) NOT NULL,
    evidence_custody_head_hash CHAR(64) NOT NULL,

    outcome_execution_id UUID NOT NULL,
    outcome_proposal_id UUID NOT NULL,
    outcome_decision_version INTEGER NOT NULL,
    governed_outcome VARCHAR(60) NOT NULL,

    outcome_attestation_id UUID NOT NULL,
    outcome_provenance_hash CHAR(64) NOT NULL,
    outcome_audit_root_hash CHAR(64) NOT NULL,

    conclusion_summary VARCHAR(4000) NOT NULL,
    release_rationale VARCHAR(2000) NOT NULL,

    release_fingerprint CHAR(64) NOT NULL,

    status VARCHAR(20) NOT NULL,

    prepared_by VARCHAR(180) NOT NULL,
    prepared_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_conclusion_package_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_conclusion_package_finding
        FOREIGN KEY (finding_id)
        REFERENCES investigation_findings(id),

    CONSTRAINT fk_conclusion_package_finding_review
        FOREIGN KEY (finding_review_id)
        REFERENCES investigation_finding_reviews(id),

    CONSTRAINT fk_conclusion_package_evidence
        FOREIGN KEY (evidence_id)
        REFERENCES investigation_evidence_registry(id),

    CONSTRAINT fk_conclusion_package_evidence_review
        FOREIGN KEY (evidence_review_id)
        REFERENCES investigation_evidence_reviews(id),

    CONSTRAINT fk_conclusion_package_execution
        FOREIGN KEY (outcome_execution_id)
        REFERENCES case_decision_executions(id),

    CONSTRAINT fk_conclusion_package_proposal
        FOREIGN KEY (outcome_proposal_id)
        REFERENCES case_decision_proposals(id),

    CONSTRAINT fk_conclusion_package_attestation
        FOREIGN KEY (outcome_attestation_id)
        REFERENCES case_outcome_attestations(id),

    CONSTRAINT uq_conclusion_package_version
        UNIQUE (
            case_id,
            package_version
        ),

    CONSTRAINT chk_conclusion_package_version
        CHECK (
            package_version > 0
        ),

    CONSTRAINT chk_conclusion_finding_version
        CHECK (
            finding_version > 0
        ),

    CONSTRAINT chk_conclusion_evidence_review_version
        CHECK (
            evidence_review_version > 0
        ),

    CONSTRAINT chk_conclusion_outcome_version
        CHECK (
            outcome_decision_version > 0
        ),

    CONSTRAINT chk_conclusion_registry_hash
        CHECK (
            evidence_registry_fingerprint
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_conclusion_custody_hash
        CHECK (
            evidence_custody_head_hash
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_conclusion_provenance_hash
        CHECK (
            outcome_provenance_hash
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_conclusion_audit_root_hash
        CHECK (
            outcome_audit_root_hash
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_conclusion_release_fingerprint
        CHECK (
            release_fingerprint
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_conclusion_status
        CHECK (
            status IN (
                'PENDING',
                'RELEASED',
                'REJECTED'
            )
        )
);

CREATE UNIQUE INDEX uq_pending_conclusion_package
    ON investigation_conclusion_packages(
        case_id
    )
    WHERE status = 'PENDING';

CREATE UNIQUE INDEX uq_released_conclusion_package
    ON investigation_conclusion_packages(
        case_id
    )
    WHERE status = 'RELEASED';

CREATE TABLE investigation_conclusion_release_reviews (
    id UUID PRIMARY KEY,

    package_id UUID NOT NULL UNIQUE,

    decision VARCHAR(20) NOT NULL,
    review_note VARCHAR(2000) NOT NULL,

    reviewed_by VARCHAR(180) NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_conclusion_release_review_package
        FOREIGN KEY (package_id)
        REFERENCES investigation_conclusion_packages(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_conclusion_release_decision
        CHECK (
            decision IN (
                'RELEASED',
                'REJECTED'
            )
        )
);

CREATE INDEX idx_conclusion_package_case
    ON investigation_conclusion_packages(
        case_id,
        package_version DESC
    );

CREATE INDEX idx_conclusion_package_finding
    ON investigation_conclusion_packages(
        finding_id,
        prepared_at DESC
    );

CREATE INDEX idx_conclusion_package_status
    ON investigation_conclusion_packages(
        status,
        prepared_at DESC
    );
