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
@Table(name = "watchlist_entries")
public class WatchlistEntryEntity {

    public enum WatchlistCategory {
        SANCTIONS,
        PEP
    }

    public enum RiskLevel {
        MEDIUM,
        HIGH,
        CRITICAL
    }

    @Id
    private UUID id;

    @Column(
            name = "list_key",
            nullable = false,
            unique = true,
            length = 80
    )
    private String listKey;

    @Column(
            name = "full_name",
            nullable = false,
            length = 220
    )
    private String fullName;

    @Column(
            name = "normalized_name",
            nullable = false,
            length = 220
    )
    private String normalizedName;

    @Column(
            nullable = false,
            length = 1000
    )
    private String aliases;

    @Column(
            name = "country_code",
            length = 8
    )
    private String countryCode;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 40
    )
    private WatchlistCategory category;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "risk_level",
            nullable = false,
            length = 20
    )
    private RiskLevel riskLevel;

    @Column(
            name = "source_name",
            nullable = false,
            length = 180
    )
    private String sourceName;

    @Column(
            name = "source_reference",
            nullable = false,
            length = 180
    )
    private String sourceReference;

    @Column(nullable = false)
    private boolean active;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false
    )
    private Instant updatedAt;

    protected WatchlistEntryEntity() {
    }

    public WatchlistEntryEntity(
            UUID id,
            String listKey,
            String fullName,
            String normalizedName,
            String aliases,
            String countryCode,
            WatchlistCategory category,
            RiskLevel riskLevel,
            String sourceName,
            String sourceReference,
            boolean active,
            Instant createdAt,
            Instant updatedAt
    ) {
        this.id = id;
        this.listKey = listKey;
        this.fullName = fullName;
        this.normalizedName = normalizedName;
        this.aliases = aliases;
        this.countryCode = countryCode;
        this.category = category;
        this.riskLevel = riskLevel;
        this.sourceName = sourceName;
        this.sourceReference = sourceReference;
        this.active = active;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() {
        return id;
    }

    public String getListKey() {
        return listKey;
    }

    public String getFullName() {
        return fullName;
    }

    public String getNormalizedName() {
        return normalizedName;
    }

    public String getAliases() {
        return aliases;
    }

    public String getCountryCode() {
        return countryCode;
    }

    public WatchlistCategory getCategory() {
        return category;
    }

    public RiskLevel getRiskLevel() {
        return riskLevel;
    }

    public String getSourceName() {
        return sourceName;
    }

    public String getSourceReference() {
        return sourceReference;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
