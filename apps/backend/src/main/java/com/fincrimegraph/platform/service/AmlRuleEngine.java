package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

@Component
public class AmlRuleEngine {

    public static final int RULE_COUNT = 5;

    public List<DetectionCandidate> evaluate(
            List<TransactionEntity> transactions
    ) {
        return evaluate(
                transactions,
                RuleConfiguration.defaults()
        );
    }

    public List<DetectionCandidate> evaluate(
            List<TransactionEntity> transactions,
            RuleConfiguration configuration
    ) {
        Map<String, DetectionCandidate> results =
                new LinkedHashMap<>();

        if (configuration.circularFlow().enabled()) {
            addAll(
                    results,
                    detectCircularFlows(
                            transactions,
                            configuration.circularFlow()
                    )
            );
        }

        if (configuration.structuring().enabled()) {
            addAll(
                    results,
                    detectStructuring(
                            transactions,
                            configuration.structuring()
                    )
            );
        }

        if (configuration.largeCrossBorder().enabled()) {
            addAll(
                    results,
                    detectLargeCrossBorder(
                            transactions,
                            configuration.largeCrossBorder()
                    )
            );
        }

        if (configuration.highRiskCounterparty().enabled()) {
            addAll(
                    results,
                    detectHighRiskCounterparties(
                            transactions,
                            configuration.highRiskCounterparty()
                    )
            );
        }

        if (configuration.velocityAnomaly().enabled()) {
            addAll(
                    results,
                    detectVelocityAnomalies(
                            transactions,
                            configuration.velocityAnomaly()
                    )
            );
        }

        return List.copyOf(
                results.values()
        );
    }

    private void addAll(
            Map<String, DetectionCandidate> target,
            List<DetectionCandidate> candidates
    ) {
        for (
                DetectionCandidate candidate
                        : candidates
        ) {
            target.putIfAbsent(
                    candidate.alertCode(),
                    candidate
            );
        }
    }

    private List<DetectionCandidate> detectCircularFlows(
            List<TransactionEntity> transactions,
            RuleSetting setting
    ) {
        List<DetectionCandidate> results =
                new ArrayList<>();

        Set<String> detectedCycles =
                new TreeSet<>();

        for (TransactionEntity first : transactions) {
            for (TransactionEntity second : transactions) {

                if (!first
                        .getDestinationAccount()
                        .getId()
                        .equals(
                                second
                                        .getSourceAccount()
                                        .getId()
                        )) {
                    continue;
                }

                if (!second
                        .getOccurredAt()
                        .isAfter(
                                first.getOccurredAt()
                        )) {
                    continue;
                }

                for (TransactionEntity third : transactions) {

                    if (!second
                            .getDestinationAccount()
                            .getId()
                            .equals(
                                    third
                                            .getSourceAccount()
                                            .getId()
                            )) {
                        continue;
                    }

                    if (!third
                            .getDestinationAccount()
                            .getId()
                            .equals(
                                    first
                                            .getSourceAccount()
                                            .getId()
                            )) {
                        continue;
                    }

                    if (!third
                            .getOccurredAt()
                            .isAfter(
                                    second.getOccurredAt()
                            )) {
                        continue;
                    }

                    String accountA =
                            first
                                    .getSourceAccount()
                                    .getAccountNumber();

                    String accountB =
                            first
                                    .getDestinationAccount()
                                    .getAccountNumber();

                    String accountC =
                            second
                                    .getDestinationAccount()
                                    .getAccountNumber();

                    if (
                            accountA.equals(accountB)
                                    || accountA.equals(accountC)
                                    || accountB.equals(accountC)
                    ) {
                        continue;
                    }

                    Duration duration =
                            Duration.between(
                                    first.getOccurredAt(),
                                    third.getOccurredAt()
                            );

                    if (
                            duration.isNegative()
                                    || duration.compareTo(
                                            Duration.ofMinutes(
                                                    setting.windowMinutes()
                                            )
                                    ) > 0
                    ) {
                        continue;
                    }

                    List<String> cycleAccounts =
                            List.of(
                                    accountA,
                                    accountB,
                                    accountC
                            )
                                    .stream()
                                    .sorted()
                                    .toList();

                    String cycleKey =
                            String.join(
                                    "|",
                                    cycleAccounts
                            );

                    if (!detectedCycles.add(
                            cycleKey
                    )) {
                        continue;
                    }

                    results.add(
                            new DetectionCandidate(
                                    "AUTO-CIRC-"
                                            + stableToken(
                                                    cycleKey
                                            ),
                                    AlertEntity.AlertType
                                            .CIRCULAR_FLOW,
                                    setting.severity(),
                                    setting.riskScore(),
                                    "Circular money flow detected",
                                    "Three accounts formed a closed transfer cycle "
                                            + "within "
                                            + duration.toMinutes()
                                            + " minutes.",
                                    cycleAccounts
                                            .getFirst(),
                                    third.getReference(),
                                    "CIRCULAR_FLOW_3_HOP"
                            )
                    );
                }
            }
        }

        return results;
    }

    private List<DetectionCandidate> detectStructuring(
            List<TransactionEntity> transactions,
            RuleSetting setting
    ) {
        Map<String, List<TransactionEntity>> grouped =
                new HashMap<>();

        for (
                TransactionEntity transaction
                        : transactions
        ) {
            if (
                    transaction
                            .getAmount()
                            .compareTo(
                                    setting.primaryAmountThreshold()
                            ) < 0
            ) {
                continue;
            }

            if (
                    transaction
                            .getAmount()
                            .compareTo(
                                    setting.secondaryAmountThreshold()
                            ) >= 0
            ) {
                continue;
            }

            String key =
                    transaction
                            .getSourceAccount()
                            .getAccountNumber()
                            + "|"
                            + transaction
                            .getDestinationAccount()
                            .getAccountNumber();

            grouped
                    .computeIfAbsent(
                            key,
                            ignored ->
                                    new ArrayList<>()
                    )
                    .add(transaction);
        }

        List<DetectionCandidate> results =
                new ArrayList<>();

        for (
                Map.Entry<
                        String,
                        List<TransactionEntity>
                        > entry
                        : grouped.entrySet()
        ) {
            List<TransactionEntity> group =
                    entry
                            .getValue()
                            .stream()
                            .sorted(
                                    Comparator.comparing(
                                            TransactionEntity
                                                    ::getOccurredAt
                                    )
                            )
                            .toList();

            if (
                    group.size()
                            < setting.minimumOccurrences()
            ) {
                continue;
            }

            Duration span =
                    Duration.between(
                            group
                                    .getFirst()
                                    .getOccurredAt(),
                            group
                                    .getLast()
                                    .getOccurredAt()
                    );

            if (
                    span.compareTo(
                            Duration.ofMinutes(
                                    setting.windowMinutes()
                            )
                    ) > 0
            ) {
                continue;
            }

            BigDecimal total =
                    group
                            .stream()
                            .map(
                                    TransactionEntity
                                            ::getAmount
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            if (
                    total.compareTo(
                            setting.aggregateAmountThreshold()
                    ) < 0
            ) {
                continue;
            }

            TransactionEntity evidence =
                    group.getLast();

            String sourceAccount =
                    evidence
                            .getSourceAccount()
                            .getAccountNumber();

            String destinationAccount =
                    evidence
                            .getDestinationAccount()
                            .getAccountNumber();

            results.add(
                    new DetectionCandidate(
                            "AUTO-STRUCT-"
                                    + stableToken(
                                            sourceAccount
                                                    + "|"
                                                    + destinationAccount
                                    ),
                            AlertEntity.AlertType
                                    .STRUCTURING,
                            setting.severity(),
                            setting.riskScore(),
                            "Possible structuring pattern detected",
                            group.size()
                                    + " transfers totaling "
                                    + total
                                    + " occurred within "
                                    + span.toMinutes()
                                    + " minutes.",
                            sourceAccount,
                            evidence.getReference(),
                            "STRUCTURING_CLUSTER"
                    )
            );
        }

        return results;
    }

    private List<DetectionCandidate> detectLargeCrossBorder(
            List<TransactionEntity> transactions,
            RuleSetting setting
    ) {
        List<DetectionCandidate> results =
                new ArrayList<>();

        for (
                TransactionEntity transaction
                        : transactions
        ) {
            if (
                    transaction
                            .getAmount()
                            .compareTo(
                                    setting.primaryAmountThreshold()
                            ) < 0
            ) {
                continue;
            }

            if (!isCrossBorder(
                    transaction
            )) {
                continue;
            }

            results.add(
                    new DetectionCandidate(
                            "AUTO-XB-"
                                    + stableToken(
                                            transaction
                                                    .getReference()
                                    ),
                            AlertEntity.AlertType
                                    .LARGE_CROSS_BORDER,
                            setting.severity(),
                            setting.riskScore(),
                            "Large cross-border transfer detected",
                            "A "
                                    + transaction.getAmount()
                                    + " "
                                    + transaction.getCurrency()
                                    + " transfer crossed customer jurisdictions.",
                            transaction
                                    .getSourceAccount()
                                    .getAccountNumber(),
                            transaction.getReference(),
                            "LARGE_CROSS_BORDER"
                    )
            );
        }

        return results;
    }

    private List<DetectionCandidate>
    detectHighRiskCounterparties(
            List<TransactionEntity> transactions,
            RuleSetting setting
    ) {
        List<DetectionCandidate> results =
                new ArrayList<>();

        for (
                TransactionEntity transaction
                        : transactions
        ) {
            if (
                    transaction
                            .getAmount()
                            .compareTo(
                                    setting.primaryAmountThreshold()
                            ) < 0
            ) {
                continue;
            }

            if (!isCrossBorder(
                    transaction
            )) {
                continue;
            }

            CustomerEntity sourceCustomer =
                    transaction
                            .getSourceAccount()
                            .getCustomer();

            CustomerEntity destinationCustomer =
                    transaction
                            .getDestinationAccount()
                            .getCustomer();

            if (
                    sourceCustomer.getRiskTier()
                            != CustomerEntity.RiskTier.HIGH
                            && destinationCustomer.getRiskTier()
                            != CustomerEntity.RiskTier.HIGH
            ) {
                continue;
            }

            results.add(
                    new DetectionCandidate(
                            "AUTO-HRCP-"
                                    + stableToken(
                                            transaction
                                                    .getReference()
                                    ),
                            AlertEntity.AlertType
                                    .HIGH_RISK_COUNTERPARTY,
                            setting.severity(),
                            setting.riskScore(),
                            "High-risk counterparty exposure",
                            "A material cross-border transfer involved "
                                    + "at least one high-risk customer relationship.",
                            transaction
                                    .getSourceAccount()
                                    .getAccountNumber(),
                            transaction.getReference(),
                            "HIGH_RISK_COUNTERPARTY"
                    )
            );
        }

        return results;
    }

    private List<DetectionCandidate>
    detectVelocityAnomalies(
            List<TransactionEntity> transactions,
            RuleSetting setting
    ) {
        Map<String, List<TransactionEntity>> byAccount =
                new HashMap<>();

        for (
                TransactionEntity transaction
                        : transactions
        ) {
            String source =
                    transaction
                            .getSourceAccount()
                            .getAccountNumber();

            String destination =
                    transaction
                            .getDestinationAccount()
                            .getAccountNumber();

            byAccount
                    .computeIfAbsent(
                            source,
                            ignored ->
                                    new ArrayList<>()
                    )
                    .add(transaction);

            if (!source.equals(
                    destination
            )) {
                byAccount
                        .computeIfAbsent(
                                destination,
                                ignored ->
                                        new ArrayList<>()
                        )
                        .add(transaction);
            }
        }

        List<DetectionCandidate> results =
                new ArrayList<>();

        for (
                Map.Entry<
                        String,
                        List<TransactionEntity>
                        > entry
                        : byAccount.entrySet()
        ) {
            List<TransactionEntity> activity =
                    entry
                            .getValue()
                            .stream()
                            .sorted(
                                    Comparator.comparing(
                                            TransactionEntity
                                                    ::getOccurredAt
                                    )
                            )
                            .toList();

            boolean detected =
                    false;

            int minimumOccurrences =
                    Math.max(
                            2,
                            setting.minimumOccurrences()
                    );

            for (
                    int start = 0;
                    start < activity.size()
                            && !detected;
                    start++
            ) {
                int minimumEnd =
                        start
                                + minimumOccurrences
                                - 1;

                for (
                        int end = minimumEnd;
                        end < activity.size();
                        end++
                ) {
                    Duration window =
                            Duration.between(
                                    activity
                                            .get(start)
                                            .getOccurredAt(),
                                    activity
                                            .get(end)
                                            .getOccurredAt()
                            );

                    if (
                            window.compareTo(
                                    Duration.ofMinutes(
                                            setting.windowMinutes()
                                    )
                            ) <= 0
                    ) {
                        TransactionEntity evidence =
                                activity.get(end);

                        results.add(
                                new DetectionCandidate(
                                        "AUTO-VEL-"
                                                + stableToken(
                                                        entry.getKey()
                                                ),
                                        AlertEntity.AlertType
                                                .VELOCITY_ANOMALY,
                                        setting.severity(),
                                        setting.riskScore(),
                                        "Transaction velocity anomaly",
                                        "At least "
                                                + minimumOccurrences
                                                + " account interactions occurred inside "
                                                + setting.windowMinutes()
                                                + " minutes.",
                                        entry.getKey(),
                                        evidence.getReference(),
                                        "TRANSACTION_VELOCITY"
                                )
                        );

                        detected = true;
                        break;
                    }
                }
            }
        }

        return results;
    }

    private boolean isCrossBorder(
            TransactionEntity transaction
    ) {
        String sourceCountry =
                transaction
                        .getSourceAccount()
                        .getCustomer()
                        .getCountryCode();

        String destinationCountry =
                transaction
                        .getDestinationAccount()
                        .getCustomer()
                        .getCountryCode();

        return !sourceCountry.equals(
                destinationCountry
        );
    }

    private String stableToken(
            String value
    ) {
        return UUID
                .nameUUIDFromBytes(
                        value.getBytes(
                                StandardCharsets.UTF_8
                        )
                )
                .toString()
                .substring(
                        0,
                        8
                )
                .toUpperCase(
                        Locale.ROOT
                );
    }

    public record DetectionCandidate(
            String alertCode,
            AlertEntity.AlertType type,
            AlertEntity.AlertSeverity severity,
            int riskScore,
            String title,
            String description,
            String primaryAccountNumber,
            String transactionReference,
            String ruleId
    ) {
    }

    public record RuleSetting(
            boolean enabled,
            AlertEntity.AlertSeverity severity,
            int riskScore,
            BigDecimal primaryAmountThreshold,
            BigDecimal secondaryAmountThreshold,
            BigDecimal aggregateAmountThreshold,
            int minimumOccurrences,
            int windowMinutes
    ) {

        public RuleSetting withEnabled(
                boolean enabled
        ) {
            return new RuleSetting(
                    enabled,
                    severity,
                    riskScore,
                    primaryAmountThreshold,
                    secondaryAmountThreshold,
                    aggregateAmountThreshold,
                    minimumOccurrences,
                    windowMinutes
            );
        }
    }

    public record RuleConfiguration(
            RuleSetting circularFlow,
            RuleSetting structuring,
            RuleSetting largeCrossBorder,
            RuleSetting highRiskCounterparty,
            RuleSetting velocityAnomaly
    ) {

        public static RuleConfiguration defaults() {
            return new RuleConfiguration(
                    new RuleSetting(
                            true,
                            AlertEntity.AlertSeverity.CRITICAL,
                            96,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            3,
                            90
                    ),
                    new RuleSetting(
                            true,
                            AlertEntity.AlertSeverity.HIGH,
                            88,
                            new BigDecimal("4000"),
                            new BigDecimal("10000"),
                            new BigDecimal("10000"),
                            3,
                            120
                    ),
                    new RuleSetting(
                            true,
                            AlertEntity.AlertSeverity.HIGH,
                            84,
                            new BigDecimal("25000"),
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            1,
                            0
                    ),
                    new RuleSetting(
                            true,
                            AlertEntity.AlertSeverity.HIGH,
                            79,
                            new BigDecimal("10000"),
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            1,
                            0
                    ),
                    new RuleSetting(
                            true,
                            AlertEntity.AlertSeverity.MEDIUM,
                            72,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            BigDecimal.ZERO,
                            4,
                            180
                    )
            );
        }

        public int enabledCount() {
            int count = 0;

            if (circularFlow.enabled()) {
                count++;
            }

            if (structuring.enabled()) {
                count++;
            }

            if (largeCrossBorder.enabled()) {
                count++;
            }

            if (highRiskCounterparty.enabled()) {
                count++;
            }

            if (velocityAnomaly.enabled()) {
                count++;
            }

            return count;
        }
    }
}
