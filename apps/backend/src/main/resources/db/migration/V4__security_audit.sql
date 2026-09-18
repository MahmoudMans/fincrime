CREATE TABLE security_audit_events (
    id UUID PRIMARY KEY,
    username VARCHAR(180) NOT NULL,
    action VARCHAR(80) NOT NULL,
    resource_type VARCHAR(80) NOT NULL,
    resource_id VARCHAR(180),
    outcome VARCHAR(30) NOT NULL,
    detail VARCHAR(2000) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_security_audit_occurred
    ON security_audit_events(occurred_at DESC);

CREATE INDEX idx_security_audit_username
    ON security_audit_events(username);

CREATE INDEX idx_security_audit_action
    ON security_audit_events(action);

CREATE INDEX idx_security_audit_resource
    ON security_audit_events(resource_type, resource_id);
