package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "customer_risk_factors")
public class CustomerRiskFactorEntity {

    @Id
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "assessment_id",
            nullable = false
    )
    private CustomerRiskAssessmentEntity assessment;

    @Column(
            name = "factor_key",
            nullable = false,
            length = 80
    )
    private String factorKey;

    @Column(
            nullable = false,
            length = 180
    )
    private String label;

    @Column(
            name = "raw_value",
            nullable = false,
            length = 1000
    )
    private String rawValue;

    @Column(nullable = false)
    private int contribution;

    @Column(
            nullable = false,
            length = 2000
    )
    private String explanation;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected CustomerRiskFactorEntity() {
    }

    public CustomerRiskFactorEntity(
            UUID id,
            CustomerRiskAssessmentEntity assessment,
            String factorKey,
            String label,
            String rawValue,
            int contribution,
            String explanation,
            Instant createdAt
    ) {
        this.id = id;
        this.assessment = assessment;
        this.factorKey = factorKey;
        this.label = label;
        this.rawValue = rawValue;
        this.contribution = contribution;
        this.explanation = explanation;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public CustomerRiskAssessmentEntity getAssessment() {
        return assessment;
    }

    public String getFactorKey() {
        return factorKey;
    }

    public String getLabel() {
        return label;
    }

    public String getRawValue() {
        return rawValue;
    }

    public int getContribution() {
        return contribution;
    }

    public String getExplanation() {
        return explanation;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
