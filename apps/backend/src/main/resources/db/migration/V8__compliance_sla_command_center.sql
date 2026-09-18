CREATE TABLE compliance_sla_policies (
    priority VARCHAR(20) PRIMARY KEY,
    target_hours INTEGER NOT NULL,
    active BOOLEAN NOT NULL,
    description VARCHAR(1000) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT chk_compliance_sla_target_hours
        CHECK (target_hours > 0)
);

CREATE TABLE case_sla_status (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL UNIQUE,

    case_number VARCHAR(120) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    case_status VARCHAR(40) NOT NULL,

    target_hours INTEGER NOT NULL,
    elapsed_hours BIGINT NOT NULL,
    breach_hours BIGINT NOT NULL,

    sla_state VARCHAR(40) NOT NULL,

    calculated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_case_sla_status_case
        FOREIGN KEY (case_id)
        REFERENCES investigation_cases(id)
        ON DELETE CASCADE,

    CONSTRAINT chk_case_sla_elapsed_hours
        CHECK (elapsed_hours >= 0),

    CONSTRAINT chk_case_sla_breach_hours
        CHECK (breach_hours >= 0)
);

CREATE INDEX idx_case_sla_status_state
    ON case_sla_status(
        sla_state
    );

CREATE INDEX idx_case_sla_status_priority
    ON case_sla_status(
        priority
    );

CREATE INDEX idx_case_sla_status_breach
    ON case_sla_status(
        breach_hours DESC
    );

-- Demo portfolio policy only.
-- These values are not represented as a regulatory standard.
INSERT INTO compliance_sla_policies (
    priority,
    target_hours,
    active,
    description,
    updated_at
)
VALUES
(
    'CRITICAL',
    4,
    TRUE,
    'Portfolio demonstration policy for critical-priority investigation cases.',
    CURRENT_TIMESTAMP
),
(
    'HIGH',
    12,
    TRUE,
    'Portfolio demonstration policy for high-priority investigation cases.',
    CURRENT_TIMESTAMP
),
(
    'MEDIUM',
    24,
    TRUE,
    'Portfolio demonstration policy for medium-priority investigation cases.',
    CURRENT_TIMESTAMP
),
(
    'LOW',
    48,
    TRUE,
    'Portfolio demonstration policy for low-priority investigation cases.',
    CURRENT_TIMESTAMP
);
