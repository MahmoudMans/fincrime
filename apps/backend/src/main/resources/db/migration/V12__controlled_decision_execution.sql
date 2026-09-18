CREATE TABLE case_decision_executions (
    id UUID PRIMARY KEY,

    proposal_id UUID NOT NULL UNIQUE,
    case_id UUID NOT NULL,

    decision_version INTEGER NOT NULL,

    source_recommendation VARCHAR(40) NOT NULL,
    governed_outcome VARCHAR(60) NOT NULL,

    source_proposed_by VARCHAR(180) NOT NULL,
    source_reviewed_by VARCHAR(180) NOT NULL,

    execution_note VARCHAR(2000) NOT NULL,

    executed_by VARCHAR(180) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_decision_execution_proposal
        FOREIGN KEY (proposal_id)
        REFERENCES case_decision_proposals(id),

    CONSTRAINT fk_decision_execution_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id),

    CONSTRAINT chk_decision_execution_version
        CHECK (
            decision_version > 0
        ),

    CONSTRAINT chk_decision_execution_recommendation
        CHECK (
            source_recommendation IN (
                'ESCALATE',
                'CONTINUE_INVESTIGATION',
                'CLOSE_NO_ACTION'
            )
        ),

    CONSTRAINT chk_decision_execution_outcome
        CHECK (
            governed_outcome IN (
                'ESCALATED_FOR_REVIEW',
                'CONTINUE_INVESTIGATION',
                'CLOSED_NO_ACTION'
            )
        )
);

CREATE TABLE governed_case_outcomes (
    case_id UUID PRIMARY KEY,

    execution_id UUID NOT NULL UNIQUE,
    proposal_id UUID NOT NULL UNIQUE,

    decision_version INTEGER NOT NULL,
    governed_outcome VARCHAR(60) NOT NULL,

    effective_at TIMESTAMPTZ NOT NULL,
    last_updated_by VARCHAR(180) NOT NULL,

    CONSTRAINT fk_governed_outcome_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_governed_outcome_execution
        FOREIGN KEY (execution_id)
        REFERENCES case_decision_executions(id),

    CONSTRAINT fk_governed_outcome_proposal
        FOREIGN KEY (proposal_id)
        REFERENCES case_decision_proposals(id),

    CONSTRAINT chk_governed_outcome_version
        CHECK (
            decision_version > 0
        ),

    CONSTRAINT chk_governed_outcome_value
        CHECK (
            governed_outcome IN (
                'ESCALATED_FOR_REVIEW',
                'CONTINUE_INVESTIGATION',
                'CLOSED_NO_ACTION'
            )
        )
);

CREATE INDEX idx_decision_execution_case
    ON case_decision_executions(
        case_id,
        executed_at DESC
    );

CREATE INDEX idx_decision_execution_time
    ON case_decision_executions(
        executed_at DESC
    );

CREATE INDEX idx_governed_case_outcome
    ON governed_case_outcomes(
        governed_outcome
    );
