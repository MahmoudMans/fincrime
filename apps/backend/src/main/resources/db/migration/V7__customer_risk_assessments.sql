CREATE TABLE customer_risk_assessments (
    id UUID PRIMARY KEY,
    batch_id UUID NOT NULL,
    customer_id UUID NOT NULL,

    score INTEGER NOT NULL,
    risk_band VARCHAR(20) NOT NULL,

    model_version VARCHAR(40) NOT NULL,
    generated_by VARCHAR(180) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_customer_risk_assessment_customer
        FOREIGN KEY (customer_id)
        REFERENCES customers(id),

    CONSTRAINT chk_customer_risk_score
        CHECK (
            score BETWEEN 0 AND 100
        )
);

CREATE TABLE customer_risk_factors (
    id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL,

    factor_key VARCHAR(80) NOT NULL,
    label VARCHAR(180) NOT NULL,

    raw_value VARCHAR(1000) NOT NULL,
    contribution INTEGER NOT NULL,
    explanation VARCHAR(2000) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT fk_customer_risk_factor_assessment
        FOREIGN KEY (assessment_id)
        REFERENCES customer_risk_assessments(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_customer_risk_factor
        UNIQUE (
            assessment_id,
            factor_key
        ),

    CONSTRAINT chk_customer_risk_factor_contribution
        CHECK (
            contribution BETWEEN 0 AND 100
        )
);

CREATE INDEX idx_customer_risk_assessment_customer
    ON customer_risk_assessments(
        customer_id,
        generated_at DESC
    );

CREATE INDEX idx_customer_risk_assessment_batch
    ON customer_risk_assessments(
        batch_id
    );

CREATE INDEX idx_customer_risk_assessment_score
    ON customer_risk_assessments(
        score DESC
    );

CREATE INDEX idx_customer_risk_factor_assessment
    ON customer_risk_factors(
        assessment_id
    );
