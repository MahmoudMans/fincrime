CREATE TABLE customers (
    id UUID PRIMARY KEY,
    external_id VARCHAR(32) NOT NULL UNIQUE,
    full_name VARCHAR(160) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    risk_tier VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    account_number VARCHAR(64) NOT NULL UNIQUE,
    account_type VARCHAR(32) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    balance NUMERIC(19, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    customer_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_accounts_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id)
);

CREATE TABLE financial_transactions (
    id UUID PRIMARY KEY,
    reference VARCHAR(64) NOT NULL UNIQUE,
    source_account_id UUID NOT NULL,
    destination_account_id UUID NOT NULL,
    amount NUMERIC(19, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    channel VARCHAR(32) NOT NULL,
    destination_country VARCHAR(2) NOT NULL,
    status VARCHAR(20) NOT NULL,

    CONSTRAINT fk_transactions_source
        FOREIGN KEY (source_account_id)
        REFERENCES accounts(id),

    CONSTRAINT fk_transactions_destination
        FOREIGN KEY (destination_account_id)
        REFERENCES accounts(id)
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    alert_code VARCHAR(64) NOT NULL UNIQUE,
    alert_type VARCHAR(64) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    risk_score INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description VARCHAR(1000) NOT NULL,
    primary_account_id UUID,
    transaction_id UUID,
    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_alerts_account
        FOREIGN KEY (primary_account_id)
        REFERENCES accounts(id),

    CONSTRAINT fk_alerts_transaction
        FOREIGN KEY (transaction_id)
        REFERENCES financial_transactions(id)
);

CREATE INDEX idx_customers_risk_tier
    ON customers(risk_tier);

CREATE INDEX idx_accounts_customer
    ON accounts(customer_id);

CREATE INDEX idx_transactions_source
    ON financial_transactions(source_account_id);

CREATE INDEX idx_transactions_destination
    ON financial_transactions(destination_account_id);

CREATE INDEX idx_transactions_occurred_at
    ON financial_transactions(occurred_at DESC);

CREATE INDEX idx_alerts_status
    ON alerts(status);

CREATE INDEX idx_alerts_risk_score
    ON alerts(risk_score DESC);
