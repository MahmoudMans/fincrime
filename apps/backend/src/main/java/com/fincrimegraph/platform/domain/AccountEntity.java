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
@Table(name = "accounts")
public class AccountEntity {

    public enum AccountType {
        CHECKING,
        SAVINGS,
        BUSINESS
    }

    public enum AccountStatus {
        ACTIVE,
        REVIEW,
        FROZEN
    }

    @Id
    private UUID id;

    @Column(name = "account_number", nullable = false, unique = true, length = 64)
    private String accountNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 32)
    private AccountType accountType;

    @Column(nullable = false, length = 3)
    private String currency;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal balance;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AccountStatus status;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "customer_id", nullable = false)
    private CustomerEntity customer;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AccountEntity() {
    }

    public AccountEntity(
            UUID id,
            String accountNumber,
            AccountType accountType,
            String currency,
            BigDecimal balance,
            AccountStatus status,
            CustomerEntity customer,
            Instant createdAt
    ) {
        this.id = id;
        this.accountNumber = accountNumber;
        this.accountType = accountType;
        this.currency = currency;
        this.balance = balance;
        this.status = status;
        this.customer = customer;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getAccountNumber() {
        return accountNumber;
    }

    public AccountType getAccountType() {
        return accountType;
    }

    public String getCurrency() {
        return currency;
    }

    public BigDecimal getBalance() {
        return balance;
    }

    public AccountStatus getStatus() {
        return status;
    }

    public CustomerEntity getCustomer() {
        return customer;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
