CREATE TABLE case_decision_proposals (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL,
    version INTEGER NOT NULL,
    recommendation VARCHAR(40) NOT NULL,
    rationale VARCHAR(2000) NOT NULL,
    status VARCHAR(20) NOT NULL,
    proposed_by VARCHAR(180) NOT NULL,
    proposed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_decision_proposal_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_case_decision_version
        UNIQUE (case_id, version),

    CONSTRAINT chk_case_decision_version
        CHECK (version > 0),

    CONSTRAINT chk_case_decision_recommendation
        CHECK (
            recommendation IN (
                'ESCALATE',
                'CONTINUE_INVESTIGATION',
                'CLOSE_NO_ACTION'
            )
        ),

    CONSTRAINT chk_case_decision_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE UNIQUE INDEX uq_case_pending_decision
    ON case_decision_proposals(case_id)
    WHERE status = 'PENDING';

CREATE TABLE case_decision_reviews (
    id UUID PRIMARY KEY,
    proposal_id UUID NOT NULL UNIQUE,
    decision VARCHAR(20) NOT NULL,
    review_note VARCHAR(2000) NOT NULL,
    reviewed_by VARCHAR(180) NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_decision_review_proposal
        FOREIGN KEY (proposal_id)
        REFERENCES case_decision_proposals(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_case_decision_review
        CHECK (
            decision IN (
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE INDEX idx_case_decision_proposal_case
    ON case_decision_proposals(case_id, version DESC);

CREATE INDEX idx_case_decision_proposal_status
    ON case_decision_proposals(status, proposed_at DESC);

CREATE INDEX idx_case_decision_review_reviewer
    ON case_decision_reviews(reviewed_by, reviewed_at DESC);
