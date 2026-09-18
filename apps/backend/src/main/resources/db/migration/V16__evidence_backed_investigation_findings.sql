CREATE TABLE investigation_findings (
    id UUID PRIMARY KEY,

    case_id UUID NOT NULL,

    finding_reference VARCHAR(160) NOT NULL,
    finding_version INTEGER NOT NULL,

    title VARCHAR(240) NOT NULL,
    narrative VARCHAR(4000) NOT NULL,

    evidence_id UUID NOT NULL,
    evidence_review_id UUID NOT NULL,
    evidence_review_version INTEGER NOT NULL,

    evidence_registry_fingerprint CHAR(64) NOT NULL,
    evidence_custody_head_hash CHAR(64) NOT NULL,

    status VARCHAR(20) NOT NULL,

    submitted_by VARCHAR(180) NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_investigation_finding_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investigation_finding_evidence
        FOREIGN KEY (evidence_id)
        REFERENCES investigation_evidence_registry(id),

    CONSTRAINT fk_investigation_finding_evidence_review
        FOREIGN KEY (evidence_review_id)
        REFERENCES investigation_evidence_reviews(id),

    CONSTRAINT uq_investigation_finding_version
        UNIQUE (
            case_id,
            finding_reference,
            finding_version
        ),

    CONSTRAINT chk_investigation_finding_version
        CHECK (
            finding_version > 0
        ),

    CONSTRAINT chk_investigation_finding_review_version
        CHECK (
            evidence_review_version > 0
        ),

    CONSTRAINT chk_investigation_finding_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT chk_investigation_finding_registry_hash
        CHECK (
            evidence_registry_fingerprint
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_investigation_finding_custody_hash
        CHECK (
            evidence_custody_head_hash
                ~ '^[0-9a-f]{64}$'
        )
);

CREATE UNIQUE INDEX uq_pending_investigation_finding
    ON investigation_findings(
        case_id,
        finding_reference
    )
    WHERE status = 'PENDING';

CREATE TABLE investigation_finding_reviews (
    id UUID PRIMARY KEY,

    finding_id UUID NOT NULL UNIQUE,

    decision VARCHAR(20) NOT NULL,
    review_note VARCHAR(2000) NOT NULL,

    reviewed_by VARCHAR(180) NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_investigation_finding_review
        FOREIGN KEY (finding_id)
        REFERENCES investigation_findings(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_investigation_finding_review_decision
        CHECK (
            decision IN (
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE INDEX idx_investigation_finding_case
    ON investigation_findings(
        case_id,
        submitted_at DESC
    );

CREATE INDEX idx_investigation_finding_evidence
    ON investigation_findings(
        evidence_id,
        submitted_at DESC
    );

CREATE INDEX idx_investigation_finding_status
    ON investigation_findings(
        status,
        submitted_at DESC
    );
