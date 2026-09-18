CREATE TABLE watchlist_entries (
    id UUID PRIMARY KEY,
    list_key VARCHAR(80) NOT NULL UNIQUE,

    full_name VARCHAR(220) NOT NULL,
    normalized_name VARCHAR(220) NOT NULL,
    aliases VARCHAR(1000) NOT NULL DEFAULT '',

    country_code VARCHAR(8),
    category VARCHAR(40) NOT NULL,
    risk_level VARCHAR(20) NOT NULL,

    source_name VARCHAR(180) NOT NULL,
    source_reference VARCHAR(180) NOT NULL,

    active BOOLEAN NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE screening_runs (
    id UUID PRIMARY KEY,

    status VARCHAR(30) NOT NULL,

    customers_scanned INTEGER NOT NULL,
    entries_scanned INTEGER NOT NULL,
    hits_found INTEGER NOT NULL,

    triggered_by VARCHAR(180) NOT NULL,

    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE TABLE screening_hits (
    id UUID PRIMARY KEY,

    run_id UUID NOT NULL,
    watchlist_entry_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    matched_name VARCHAR(220) NOT NULL,

    name_score INTEGER NOT NULL,
    country_match BOOLEAN NOT NULL,
    match_score INTEGER NOT NULL,

    status VARCHAR(40) NOT NULL,

    review_note VARCHAR(2000),
    reviewed_by VARCHAR(180),
    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_screening_hit_run
        FOREIGN KEY (run_id)
        REFERENCES screening_runs(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_screening_hit_watchlist
        FOREIGN KEY (watchlist_entry_id)
        REFERENCES watchlist_entries(id),

    CONSTRAINT fk_screening_hit_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id),

    CONSTRAINT uq_screening_hit_run_entry_customer
        UNIQUE (
            run_id,
            watchlist_entry_id,
            customer_id
        ),

    CONSTRAINT chk_screening_hit_name_score
        CHECK (
            name_score BETWEEN 0 AND 100
        ),

    CONSTRAINT chk_screening_hit_match_score
        CHECK (
            match_score BETWEEN 0 AND 100
        )
);

CREATE INDEX idx_watchlist_entries_active
    ON watchlist_entries(active);

CREATE INDEX idx_watchlist_entries_name
    ON watchlist_entries(normalized_name);

CREATE INDEX idx_screening_runs_started
    ON screening_runs(started_at DESC);

CREATE INDEX idx_screening_hits_run
    ON screening_hits(run_id, match_score DESC);

CREATE INDEX idx_screening_hits_customer
    ON screening_hits(customer_id);

CREATE INDEX idx_screening_hits_status
    ON screening_hits(status);

-- All entries below are synthetic portfolio data.
-- They are NOT real sanctions, PEP or adverse-media records.

INSERT INTO watchlist_entries (
    id,
    list_key,
    full_name,
    normalized_name,
    aliases,
    country_code,
    category,
    risk_level,
    source_name,
    source_reference,
    active,
    created_at,
    updated_at
)
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'SYN-SANC-001',
    'Nadia Ben Salem',
    'NADIA BEN SALEM',
    '',
    'TN',
    'SANCTIONS',
    'CRITICAL',
    'Synthetic Local Watchlist',
    'SYN-SANC-001',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000002',
    'SYN-PEP-002',
    'Nadya Ben Salem',
    'NADYA BEN SALEM',
    '',
    'TN',
    'PEP',
    'HIGH',
    'Synthetic Local Watchlist',
    'SYN-PEP-002',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000003',
    'SYN-SANC-003',
    'Orion Valez Qadir',
    'ORION VALEZ QADIR',
    '',
    'XZ',
    'SANCTIONS',
    'HIGH',
    'Synthetic Local Watchlist',
    'SYN-SANC-003',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000004',
    'SYN-PEP-004',
    'Selene Corvin Drae',
    'SELENE CORVIN DRAE',
    '',
    'XZ',
    'PEP',
    'MEDIUM',
    'Synthetic Local Watchlist',
    'SYN-PEP-004',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
