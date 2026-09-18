package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "detection_rules")
public class DetectionRuleEntity {

    @Id
    private UUID id;

    @Column(
            name = "rule_key",
            nullable = false,
            unique = true,
            length = 80
    )
    private String ruleKey;

    @Column(
            name = "display_name",
            nullable = false,
            length = 180
    )
    private String displayName;

    @Column(
            nullable = false,
            length = 1200
    )
    private String description;

    @Column(nullable = false)
    private boolean enabled;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 20
    )
    private AlertEntity.AlertSeverity severity;

    @Column(
            name = "risk_score",
            nullable = false
    )
    private int riskScore;

    @Column(
            name = "primary_amount_threshold",
            precision = 19,
            scale = 2
    )
    private BigDecimal primaryAmountThreshold;

    @Column(
            name = "secondary_amount_threshold",
            precision = 19,
            scale = 2
    )
    private BigDecimal secondaryAmountThreshold;

    @Column(
            name = "aggregate_amount_threshold",
            precision = 19,
            scale = 2
    )
    private BigDecimal aggregateAmountThreshold;

    @Column(
            name = "minimum_occurrences"
    )
    private Integer minimumOccurrences;

    @Column(
            name = "window_minutes"
    )
    private Integer windowMinutes;

    @Column(nullable = false)
    private int version;

    @Column(
            name = "updated_by",
            nullable = false,
            length = 180
    )
    private String updatedBy;

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

    protected DetectionRuleEntity() {
    }

    public void update(
            boolean enabled,
            AlertEntity.AlertSeverity severity,
            int riskScore,
            BigDecimal primaryAmountThreshold,
            BigDecimal secondaryAmountThreshold,
            BigDecimal aggregateAmountThreshold,
            Integer minimumOccurrences,
            Integer windowMinutes,
            String updatedBy,
            Instant updatedAt
    ) {
        this.enabled = enabled;
        this.severity = severity;
        this.riskScore = riskScore;
        this.primaryAmountThreshold =
                primaryAmountThreshold;
        this.secondaryAmountThreshold =
                secondaryAmountThreshold;
        this.aggregateAmountThreshold =
                aggregateAmountThreshold;
        this.minimumOccurrences =
                minimumOccurrences;
        this.windowMinutes =
                windowMinutes;
        this.version++;
        this.updatedBy = updatedBy;
        this.updatedAt = updatedAt;
    }

    public UUID getId() {
        return id;
    }

    public String getRuleKey() {
        return ruleKey;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getDescription() {
        return description;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public AlertEntity.AlertSeverity getSeverity() {
        return severity;
    }

    public int getRiskScore() {
        return riskScore;
    }

    public BigDecimal getPrimaryAmountThreshold() {
        return primaryAmountThreshold;
    }

    public BigDecimal getSecondaryAmountThreshold() {
        return secondaryAmountThreshold;
    }

    public BigDecimal getAggregateAmountThreshold() {
        return aggregateAmountThreshold;
    }

    public Integer getMinimumOccurrences() {
        return minimumOccurrences;
    }

    public Integer getWindowMinutes() {
        return windowMinutes;
    }

    public int getVersion() {
        return version;
    }

    public String getUpdatedBy() {
        return updatedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
