package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "customers")
public class CustomerEntity {

    public enum RiskTier {
        LOW,
        MEDIUM,
        HIGH
    }

    @Id
    private UUID id;

    @Column(name = "external_id", nullable = false, unique = true, length = 32)
    private String externalId;

    @Column(name = "full_name", nullable = false, length = 160)
    private String fullName;

    @Column(name = "country_code", nullable = false, length = 2)
    private String countryCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "risk_tier", nullable = false, length = 20)
    private RiskTier riskTier;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected CustomerEntity() {
    }

    public CustomerEntity(
            UUID id,
            String externalId,
            String fullName,
            String countryCode,
            RiskTier riskTier,
            Instant createdAt
    ) {
        this.id = id;
        this.externalId = externalId;
        this.fullName = fullName;
        this.countryCode = countryCode;
        this.riskTier = riskTier;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public String getExternalId() {
        return externalId;
    }

    public String getFullName() {
        return fullName;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public RiskTier getRiskTier() {
        return riskTier;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
