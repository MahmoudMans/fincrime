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
@Table(name = "customer_risk_assessments")
public class CustomerRiskAssessmentEntity {

    public enum RiskBand {
        LOW,
        MEDIUM,
        HIGH,
        CRITICAL
    }

    @Id
    private UUID id;

    @Column(
            name = "batch_id",
            nullable = false
    )
    private UUID batchId;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "customer_id",
            nullable = false
    )
    private CustomerEntity customer;

    @Column(nullable = false)
    private int score;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "risk_band",
            nullable = false,
            length = 20
    )
    private RiskBand riskBand;

    @Column(
            name = "model_version",
            nullable = false,
            length = 40
    )
    private String modelVersion;

    @Column(
            name = "generated_by",
            nullable = false,
            length = 180
    )
    private String generatedBy;

    @Column(
            name = "generated_at",
            nullable = false
    )
    private Instant generatedAt;

    protected CustomerRiskAssessmentEntity() {
    }

    public CustomerRiskAssessmentEntity(
            UUID id,
            UUID batchId,
            CustomerEntity customer,
            int score,
            RiskBand riskBand,
            String modelVersion,
            String generatedBy,
            Instant generatedAt
    ) {
        this.id = id;
        this.batchId = batchId;
        this.customer = customer;
        this.score = score;
        this.riskBand = riskBand;
        this.modelVersion = modelVersion;
        this.generatedBy = generatedBy;
        this.generatedAt = generatedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getBatchId() {
        return batchId;
    }

    public CustomerEntity getCustomer() {
        return customer;
    }

    public int getScore() {
        return score;
    }

    public RiskBand getRiskBand() {
        return riskBand;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public String getGeneratedBy() {
        return generatedBy;
    }

    public Instant getGeneratedAt() {
        return generatedAt;
    }
}
