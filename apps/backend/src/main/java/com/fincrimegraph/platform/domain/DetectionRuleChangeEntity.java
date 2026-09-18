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
@Table(name = "detection_rule_changes")
public class DetectionRuleChangeEntity {

    @Id
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "rule_id",
            nullable = false
    )
    private DetectionRuleEntity rule;

    @Column(nullable = false)
    private int version;

    @Column(
            name = "changed_by",
            nullable = false,
            length = 180
    )
    private String changedBy;

    @Column(
            name = "change_summary",
            nullable = false,
            length = 2000
    )
    private String changeSummary;

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

    @Column(
            name = "changed_at",
            nullable = false
    )
    private Instant changedAt;

    protected DetectionRuleChangeEntity() {
    }

    public DetectionRuleChangeEntity(
            UUID id,
            DetectionRuleEntity rule,
            int version,
            String changedBy,
            String changeSummary,
            boolean enabled,
            AlertEntity.AlertSeverity severity,
            int riskScore,
            BigDecimal primaryAmountThreshold,
            BigDecimal secondaryAmountThreshold,
            BigDecimal aggregateAmountThreshold,
            Integer minimumOccurrences,
            Integer windowMinutes,
            Instant changedAt
    ) {
        this.id = id;
        this.rule = rule;
        this.version = version;
        this.changedBy = changedBy;
        this.changeSummary = changeSummary;
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
        this.changedAt = changedAt;
    }

    public UUID getId() {
        return id;
    }

    public DetectionRuleEntity getRule() {
        return rule;
    }

    public int getVersion() {
        return version;
    }

    public String getChangedBy() {
        return changedBy;
    }

    public String getChangeSummary() {
        return changeSummary;
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

    public Instant getChangedAt() {
        return changedAt;
    }
}
