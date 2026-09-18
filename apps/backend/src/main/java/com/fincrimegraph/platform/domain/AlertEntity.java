package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "alerts")
public class AlertEntity {

    public enum AlertType {
        CIRCULAR_FLOW,
        STRUCTURING,
        LARGE_CROSS_BORDER,
        HIGH_RISK_COUNTERPARTY,
        VELOCITY_ANOMALY
    }

    public enum AlertSeverity {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    public enum AlertStatus {
        OPEN,
        IN_REVIEW,
        CLOSED
    }

    @Id
    private UUID id;

    @Column(name = "alert_code", nullable = false, unique = true, length = 64)
    private String alertCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "alert_type", nullable = false, length = 64)
    private AlertType alertType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertSeverity severity;

    @Column(name = "risk_score", nullable = false)
    private int riskScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AlertStatus status;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 1000)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "primary_account_id")
    private AccountEntity primaryAccount;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id")
    private TransactionEntity transaction;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AlertEntity() {
    }

    public AlertEntity(
            UUID id,
            String alertCode,
            AlertType alertType,
            AlertSeverity severity,
            int riskScore,
            AlertStatus status,
            String title,
            String description,
            AccountEntity primaryAccount,
            TransactionEntity transaction,
            Instant createdAt
    ) {
        this.id = id;
        this.alertCode = alertCode;
        this.alertType = alertType;
        this.severity = severity;
        this.riskScore = riskScore;
        this.status = status;
        this.title = title;
        this.description = description;
        this.primaryAccount = primaryAccount;
        this.transaction = transaction;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getAlertCode() {
        return alertCode;
    }

    public AlertType getAlertType() {
        return alertType;
    }

    public AlertSeverity getSeverity() {
        return severity;
    }

    public int getRiskScore() {
        return riskScore;
    }

    public AlertStatus getStatus() {
        return status;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public AccountEntity getPrimaryAccount() {
        return primaryAccount;
    }

    public TransactionEntity getTransaction() {
        return transaction;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
