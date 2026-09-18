CREATE TABLE detection_rules (
    id UUID PRIMARY KEY,
    rule_key VARCHAR(80) NOT NULL UNIQUE,
    display_name VARCHAR(180) NOT NULL,
    description VARCHAR(1200) NOT NULL,

    enabled BOOLEAN NOT NULL,

    severity VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL,

    primary_amount_threshold NUMERIC(19,2),
    secondary_amount_threshold NUMERIC(19,2),
    aggregate_amount_threshold NUMERIC(19,2),

    minimum_occurrences INTEGER,
    window_minutes INTEGER,

    version INTEGER NOT NULL,

    updated_by VARCHAR(180) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT chk_detection_rule_risk_score
        CHECK (risk_score BETWEEN 0 AND 100),

    CONSTRAINT chk_detection_rule_version
        CHECK (version >= 1)
);

CREATE TABLE detection_rule_changes (
    id UUID PRIMARY KEY,
    rule_id UUID NOT NULL,

    version INTEGER NOT NULL,

    changed_by VARCHAR(180) NOT NULL,
    change_summary VARCHAR(2000) NOT NULL,

    enabled BOOLEAN NOT NULL,
    severity VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL,

    primary_amount_threshold NUMERIC(19,2),
    secondary_amount_threshold NUMERIC(19,2),
    aggregate_amount_threshold NUMERIC(19,2),

    minimum_occurrences INTEGER,
    window_minutes INTEGER,

    changed_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_detection_rule_change_rule
        FOREIGN KEY (rule_id)
        REFERENCES detection_rules(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_detection_rule_change_version
        UNIQUE (rule_id, version)
);

CREATE INDEX idx_detection_rules_enabled
    ON detection_rules(enabled);

CREATE INDEX idx_detection_rule_changes_rule
    ON detection_rule_changes(rule_id, version DESC);

INSERT INTO detection_rules (
    id,
    rule_key,
    display_name,
    description,
    enabled,
    severity,
    risk_score,
    primary_amount_threshold,
    secondary_amount_threshold,
    aggregate_amount_threshold,
    minimum_occurrences,
    window_minutes,
    version,
    updated_by,
    created_at,
    updated_at
)
VALUES
(
    '10000000-0000-0000-0000-000000000001',
    'CIRCULAR_FLOW',
    'Circular money flow',
    'Detects three-account directed transfer cycles completed inside a configured time window.',
    TRUE,
    'CRITICAL',
    96,
    NULL,
    NULL,
    NULL,
    3,
    90,
    1,
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '10000000-0000-0000-0000-000000000002',
    'STRUCTURING',
    'Structuring / smurfing',
    'Detects repeated transfers below a configurable upper amount whose aggregate exceeds the monitoring threshold.',
    TRUE,
    'HIGH',
    88,
    4000.00,
    10000.00,
    10000.00,
    3,
    120,
    1,
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '10000000-0000-0000-0000-000000000003',
    'LARGE_CROSS_BORDER',
    'Large cross-border transfer',
    'Detects cross-border transfers at or above the configured monetary threshold.',
    TRUE,
    'HIGH',
    84,
    25000.00,
    NULL,
    NULL,
    1,
    NULL,
    1,
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '10000000-0000-0000-0000-000000000004',
    'HIGH_RISK_COUNTERPARTY',
    'High-risk counterparty exposure',
    'Detects material cross-border transfers involving customers classified as high risk.',
    TRUE,
    'HIGH',
    79,
    10000.00,
    NULL,
    NULL,
    1,
    NULL,
    1,
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '10000000-0000-0000-0000-000000000005',
    'VELOCITY_ANOMALY',
    'Transaction velocity anomaly',
    'Detects multiple account interactions inside a configured monitoring window.',
    TRUE,
    'MEDIUM',
    72,
    NULL,
    NULL,
    NULL,
    4,
    180,
    1,
    'SYSTEM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO detection_rule_changes (
    id,
    rule_id,
    version,
    changed_by,
    change_summary,
    enabled,
    severity,
    risk_score,
    primary_amount_threshold,
    secondary_amount_threshold,
    aggregate_amount_threshold,
    minimum_occurrences,
    window_minutes,
    changed_at
)
SELECT
    gen_random_uuid(),
    id,
    version,
    'SYSTEM',
    'Initial rule configuration.',
    enabled,
    severity,
    risk_score,
    primary_amount_threshold,
    secondary_amount_threshold,
    aggregate_amount_threshold,
    minimum_occurrences,
    window_minutes,
    CURRENT_TIMESTAMP
FROM detection_rules;
