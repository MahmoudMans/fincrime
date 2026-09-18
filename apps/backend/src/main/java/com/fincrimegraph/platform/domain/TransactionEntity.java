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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "financial_transactions")
public class TransactionEntity {

    public enum TransactionChannel {
        WIRE,
        BANK_TRANSFER,
        CARD,
        CASH_DEPOSIT
    }

    public enum TransactionStatus {
        SETTLED,
        PENDING,
        REVIEW
    }

    @Id
    private UUID id;

    @Column(nullable = false, unique = true, length = 64)
    private String reference;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "source_account_id", nullable = false)
    private AccountEntity sourceAccount;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "destination_account_id", nullable = false)
    private AccountEntity destinationAccount;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private TransactionChannel channel;

    @Column(name = "destination_country", nullable = false, length = 2)
    private String destinationCountry;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TransactionStatus status;

    protected TransactionEntity() {
    }

    public TransactionEntity(
            UUID id,
            String reference,
            AccountEntity sourceAccount,
            AccountEntity destinationAccount,
            BigDecimal amount,
            String currency,
            Instant occurredAt,
            TransactionChannel channel,
            String destinationCountry,
            TransactionStatus status
    ) {
        this.id = id;
        this.reference = reference;
        this.sourceAccount = sourceAccount;
        this.destinationAccount = destinationAccount;
        this.amount = amount;
        this.currency = currency;
        this.occurredAt = occurredAt;
        this.channel = channel;
        this.destinationCountry = destinationCountry;
        this.status = status;
    }

    public UUID getId() {
        return id;
    }

    public String getReference() {
        return reference;
    }

    public AccountEntity getSourceAccount() {
        return sourceAccount;
    }

    public AccountEntity getDestinationAccount() {
        return destinationAccount;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public TransactionChannel getChannel() {
        return channel;
    }

    public String getDestinationCountry() {
        return destinationCountry;
    }

    public TransactionStatus getStatus() {
        return status;
    }
}
