package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.DetectionRuleChangeEntity;
import com.fincrimegraph.platform.domain.DetectionRuleEntity;
import com.fincrimegraph.platform.repository.DetectionRuleChangeRepository;
import com.fincrimegraph.platform.repository.DetectionRuleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class DetectionRuleService {

    public static final String CIRCULAR_FLOW =
            "CIRCULAR_FLOW";

    public static final String STRUCTURING =
            "STRUCTURING";

    public static final String LARGE_CROSS_BORDER =
            "LARGE_CROSS_BORDER";

    public static final String HIGH_RISK_COUNTERPARTY =
            "HIGH_RISK_COUNTERPARTY";

    public static final String VELOCITY_ANOMALY =
            "VELOCITY_ANOMALY";

    private final DetectionRuleRepository ruleRepository;
    private final DetectionRuleChangeRepository changeRepository;

    public DetectionRuleService(
            DetectionRuleRepository ruleRepository,
            DetectionRuleChangeRepository changeRepository
    ) {
        this.ruleRepository =
                ruleRepository;

        this.changeRepository =
                changeRepository;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<RuleView> rules() {
        return ruleRepository
                .findAllByOrderByRuleKeyAsc()
                .stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<RuleChangeView> history(
            String ruleKey
    ) {
        String normalized =
                normalizeRuleKey(
                        ruleKey
                );

        requireRule(
                normalized
        );

        return changeRepository
                .findByRule_RuleKeyOrderByVersionDesc(
                        normalized
                )
                .stream()
                .map(
                        change ->
                                new RuleChangeView(
                                        change
                                                .getId()
                                                .toString(),
                                        change
                                                .getRule()
                                                .getRuleKey(),
                                        change
                                                .getVersion(),
                                        change
                                                .getChangedBy(),
                                        change
                                                .getChangeSummary(),
                                        change
                                                .isEnabled(),
                                        change
                                                .getSeverity()
                                                .name(),
                                        change
                                                .getRiskScore(),
                                        change
                                                .getPrimaryAmountThreshold(),
                                        change
                                                .getSecondaryAmountThreshold(),
                                        change
                                                .getAggregateAmountThreshold(),
                                        change
                                                .getMinimumOccurrences(),
                                        change
                                                .getWindowMinutes(),
                                        change
                                                .getChangedAt()
                                )
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public AmlRuleEngine.RuleConfiguration
    runtimeConfiguration() {

        Map<String, DetectionRuleEntity> rules =
                ruleRepository
                        .findAll()
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        DetectionRuleEntity
                                                ::getRuleKey,
                                        Function.identity()
                                )
                        );

        AmlRuleEngine.RuleConfiguration defaults =
                AmlRuleEngine
                        .RuleConfiguration
                        .defaults();

        return new AmlRuleEngine.RuleConfiguration(
                toSetting(
                        requireRule(
                                rules,
                                CIRCULAR_FLOW
                        ),
                        defaults.circularFlow()
                ),
                toSetting(
                        requireRule(
                                rules,
                                STRUCTURING
                        ),
                        defaults.structuring()
                ),
                toSetting(
                        requireRule(
                                rules,
                                LARGE_CROSS_BORDER
                        ),
                        defaults.largeCrossBorder()
                ),
                toSetting(
                        requireRule(
                                rules,
                                HIGH_RISK_COUNTERPARTY
                        ),
                        defaults.highRiskCounterparty()
                ),
                toSetting(
                        requireRule(
                                rules,
                                VELOCITY_ANOMALY
                        ),
                        defaults.velocityAnomaly()
                )
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public RuleView update(
            String ruleKey,
            Boolean enabled,
            String severity,
            Integer riskScore,
            BigDecimal primaryAmountThreshold,
            BigDecimal secondaryAmountThreshold,
            BigDecimal aggregateAmountThreshold,
            Integer minimumOccurrences,
            Integer windowMinutes,
            String changedBy,
            String changeSummary
    ) {
        DetectionRuleEntity rule =
                requireRule(
                        normalizeRuleKey(
                                ruleKey
                        )
                );

        boolean resolvedEnabled =
                enabled == null
                        ? rule.isEnabled()
                        : enabled;

        AlertEntity.AlertSeverity resolvedSeverity =
                severity == null
                        || severity.isBlank()
                        ? rule.getSeverity()
                        : parseSeverity(
                                severity
                        );

        int resolvedRiskScore =
                riskScore == null
                        ? rule.getRiskScore()
                        : riskScore;

        BigDecimal resolvedPrimary =
                primaryAmountThreshold == null
                        ? rule.getPrimaryAmountThreshold()
                        : primaryAmountThreshold;

        BigDecimal resolvedSecondary =
                secondaryAmountThreshold == null
                        ? rule.getSecondaryAmountThreshold()
                        : secondaryAmountThreshold;

        BigDecimal resolvedAggregate =
                aggregateAmountThreshold == null
                        ? rule.getAggregateAmountThreshold()
                        : aggregateAmountThreshold;

        Integer resolvedMinimum =
                minimumOccurrences == null
                        ? rule.getMinimumOccurrences()
                        : minimumOccurrences;

        Integer resolvedWindow =
                windowMinutes == null
                        ? rule.getWindowMinutes()
                        : windowMinutes;

        validate(
                rule.getRuleKey(),
                resolvedRiskScore,
                resolvedPrimary,
                resolvedSecondary,
                resolvedAggregate,
                resolvedMinimum,
                resolvedWindow
        );

        String actor =
                requireText(
                        changedBy,
                        "changedBy",
                        180
                );

        String summary =
                requireText(
                        changeSummary,
                        "changeSummary",
                        2000
                );

        Instant now =
                Instant.now();

        rule.update(
                resolvedEnabled,
                resolvedSeverity,
                resolvedRiskScore,
                resolvedPrimary,
                resolvedSecondary,
                resolvedAggregate,
                resolvedMinimum,
                resolvedWindow,
                actor,
                now
        );

        DetectionRuleEntity saved =
                ruleRepository.save(
                        rule
                );

        changeRepository.save(
                new DetectionRuleChangeEntity(
                        java.util.UUID.randomUUID(),
                        saved,
                        saved.getVersion(),
                        actor,
                        summary,
                        saved.isEnabled(),
                        saved.getSeverity(),
                        saved.getRiskScore(),
                        saved.getPrimaryAmountThreshold(),
                        saved.getSecondaryAmountThreshold(),
                        saved.getAggregateAmountThreshold(),
                        saved.getMinimumOccurrences(),
                        saved.getWindowMinutes(),
                        now
                )
        );

        return toView(
                saved
        );
    }

    private AmlRuleEngine.RuleSetting toSetting(
            DetectionRuleEntity rule,
            AmlRuleEngine.RuleSetting fallback
    ) {
        return new AmlRuleEngine.RuleSetting(
                rule.isEnabled(),
                rule.getSeverity(),
                rule.getRiskScore(),
                valueOr(
                        rule.getPrimaryAmountThreshold(),
                        fallback.primaryAmountThreshold()
                ),
                valueOr(
                        rule.getSecondaryAmountThreshold(),
                        fallback.secondaryAmountThreshold()
                ),
                valueOr(
                        rule.getAggregateAmountThreshold(),
                        fallback.aggregateAmountThreshold()
                ),
                integerOr(
                        rule.getMinimumOccurrences(),
                        fallback.minimumOccurrences()
                ),
                integerOr(
                        rule.getWindowMinutes(),
                        fallback.windowMinutes()
                )
        );
    }

    private BigDecimal valueOr(
            BigDecimal value,
            BigDecimal fallback
    ) {
        return value == null
                ? fallback
                : value;
    }

    private int integerOr(
            Integer value,
            int fallback
    ) {
        return value == null
                ? fallback
                : value;
    }

    private DetectionRuleEntity requireRule(
            String ruleKey
    ) {
        return ruleRepository
                .findByRuleKey(
                        ruleKey
                )
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Detection rule not found: "
                                                + ruleKey
                                )
                );
    }

    private DetectionRuleEntity requireRule(
            Map<String, DetectionRuleEntity> rules,
            String ruleKey
    ) {
        DetectionRuleEntity rule =
                rules.get(
                        ruleKey
                );

        if (rule == null) {
            throw new IllegalStateException(
                    "Required detection rule is missing: "
                            + ruleKey
            );
        }

        return rule;
    }

    private String normalizeRuleKey(
            String value
    ) {
        return requireText(
                value,
                "ruleKey",
                80
        )
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private AlertEntity.AlertSeverity parseSeverity(
            String value
    ) {
        try {
            return AlertEntity
                    .AlertSeverity
                    .valueOf(
                            value
                                    .trim()
                                    .toUpperCase(
                                            Locale.ROOT
                                    )
                    );
        } catch (
                IllegalArgumentException exception
        ) {
            throw new IllegalArgumentException(
                    "Unsupported severity: "
                            + value
            );
        }
    }

    private void validate(
            String ruleKey,
            int riskScore,
            BigDecimal primary,
            BigDecimal secondary,
            BigDecimal aggregate,
            Integer minimumOccurrences,
            Integer windowMinutes
    ) {
        if (
                riskScore < 0
                        || riskScore > 100
        ) {
            throw new IllegalArgumentException(
                    "riskScore must be between 0 and 100."
            );
        }

        validateNonNegative(
                "primaryAmountThreshold",
                primary
        );

        validateNonNegative(
                "secondaryAmountThreshold",
                secondary
        );

        validateNonNegative(
                "aggregateAmountThreshold",
                aggregate
        );

        if (
                minimumOccurrences != null
                        && minimumOccurrences < 1
        ) {
            throw new IllegalArgumentException(
                    "minimumOccurrences must be at least 1."
            );
        }

        if (
                windowMinutes != null
                        && windowMinutes < 1
        ) {
            throw new IllegalArgumentException(
                    "windowMinutes must be at least 1."
            );
        }

        if (
                STRUCTURING.equals(ruleKey)
                        && primary != null
                        && secondary != null
                        && primary.compareTo(
                                secondary
                        ) >= 0
        ) {
            throw new IllegalArgumentException(
                    "Structuring primary threshold "
                            + "must be lower than secondary threshold."
            );
        }
    }

    private void validateNonNegative(
            String field,
            BigDecimal value
    ) {
        if (
                value != null
                        && value.signum() < 0
        ) {
            throw new IllegalArgumentException(
                    field
                            + " must not be negative."
            );
        }
    }

    private String requireText(
            String value,
            String field,
            int maximum
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    field
                            + " is required."
            );
        }

        String normalized =
                value.trim();

        if (
                normalized.length()
                        > maximum
        ) {
            throw new IllegalArgumentException(
                    field
                            + " exceeds "
                            + maximum
                            + " characters."
            );
        }

        return normalized;
    }

    private RuleView toView(
            DetectionRuleEntity rule
    ) {
        return new RuleView(
                rule.getId().toString(),
                rule.getRuleKey(),
                rule.getDisplayName(),
                rule.getDescription(),
                rule.isEnabled(),
                rule.getSeverity().name(),
                rule.getRiskScore(),
                rule.getPrimaryAmountThreshold(),
                rule.getSecondaryAmountThreshold(),
                rule.getAggregateAmountThreshold(),
                rule.getMinimumOccurrences(),
                rule.getWindowMinutes(),
                rule.getVersion(),
                rule.getUpdatedBy(),
                rule.getUpdatedAt()
        );
    }

    public record RuleView(
            String id,
            String ruleKey,
            String displayName,
            String description,
            boolean enabled,
            String severity,
            int riskScore,
            BigDecimal primaryAmountThreshold,
            BigDecimal secondaryAmountThreshold,
            BigDecimal aggregateAmountThreshold,
            Integer minimumOccurrences,
            Integer windowMinutes,
            int version,
            String updatedBy,
            Instant updatedAt
    ) {
    }

    public record RuleChangeView(
            String id,
            String ruleKey,
            int version,
            String changedBy,
            String changeSummary,
            boolean enabled,
            String severity,
            int riskScore,
            BigDecimal primaryAmountThreshold,
            BigDecimal secondaryAmountThreshold,
            BigDecimal aggregateAmountThreshold,
            Integer minimumOccurrences,
            Integer windowMinutes,
            Instant changedAt
    ) {
    }
}
