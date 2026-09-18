CREATE TABLE investigation_evidence_reviews (
    id UUID PRIMARY KEY,

    evidence_id UUID NOT NULL,

    review_version INTEGER NOT NULL,
    review_decision VARCHAR(40) NOT NULL,
    review_reason VARCHAR(2000) NOT NULL,

    registry_fingerprint CHAR(64) NOT NULL,
    custody_head_hash CHAR(64) NOT NULL,

    reviewed_by VARCHAR(180) NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_evidence_review_evidence
        FOREIGN KEY (evidence_id)
        REFERENCES investigation_evidence_registry(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_evidence_review_version
        UNIQUE (
            evidence_id,
            review_version
        ),

    CONSTRAINT uq_evidence_review_lineage
        UNIQUE (
            evidence_id,
            registry_fingerprint,
            custody_head_hash
        ),

    CONSTRAINT chk_evidence_review_version
        CHECK (
            review_version > 0
        ),

    CONSTRAINT chk_evidence_review_decision
        CHECK (
            review_decision IN (
                'ACCEPTED_FOR_ANALYSIS',
                'QUESTIONED',
                'EXCLUDED'
            )
        ),

    CONSTRAINT chk_evidence_review_registry_hash
        CHECK (
            registry_fingerprint
                ~ '^[0-9a-f]{64}$'
        ),

    CONSTRAINT chk_evidence_review_custody_hash
        CHECK (
            custody_head_hash
                ~ '^[0-9a-f]{64}$'
        )
);

CREATE INDEX idx_evidence_review_evidence
    ON investigation_evidence_reviews(
        evidence_id,
        review_version DESC
    );

CREATE INDEX idx_evidence_review_decision
    ON investigation_evidence_reviews(
        review_decision,
        reviewed_at DESC
    );

CREATE INDEX idx_evidence_review_actor
    ON investigation_evidence_reviews(
        reviewed_by,
        reviewed_at DESC
    );
