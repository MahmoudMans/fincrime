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

    private static final BigDecimal STRUCTURING_MIN =
            new BigDecimal("4000");

    private static final BigDecimal STRUCTURING_MAX =
            new BigDecimal("10000");

    private static final BigDecimal STRUCTURING_TOTAL =
            new BigDecimal("10000");

    private static final BigDecimal LARGE_CROSS_BORDER =
            new BigDecimal("25000");

    private static final BigDecimal HIGH_RISK_EXPOSURE =
            new BigDecimal("10000");

    public List<DetectionCandidate> evaluate(
            List<TransactionEntity> transactions
    ) {
        Map<String, DetectionCandidate> results =
                new LinkedHashMap<>();

        addAll(results, detectCircularFlows(transactions));
        addAll(results, detectStructuring(transactions));
        addAll(results, detectLargeCrossBorder(transactions));
        addAll(results, detectHighRiskCounterparties(transactions));
        addAll(results, detectVelocityAnomalies(transactions));

        return List.copyOf(results.values());
    }

    private void addAll(
            Map<String, DetectionCandidate> target,
            List<DetectionCandidate> candidates
    ) {
        for (DetectionCandidate candidate : candidates) {
            target.putIfAbsent(
                    candidate.alertCode(),
                    candidate
            );
        }
    }

    private List<DetectionCandidate> detectCircularFlows(
            List<TransactionEntity> transactions
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
                        .isAfter(first.getOccurredAt())) {
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
                            .isAfter(second.getOccurredAt())) {
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

                    if (accountA.equals(accountB)
                            || accountA.equals(accountC)
                            || accountB.equals(accountC)) {
                        continue;
                    }

                    Duration cycleDuration =
                            Duration.between(
                                    first.getOccurredAt(),
                                    third.getOccurredAt()
                            );

                    if (cycleDuration.isNegative()
                            || cycleDuration.compareTo(
                                    Duration.ofMinutes(90)
                            ) > 0) {
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

                    if (!detectedCycles.add(cycleKey)) {
                        continue;
                    }

                    String primaryAccount =
                            cycleAccounts.getFirst();

                    results.add(
                            new DetectionCandidate(
                                    "AUTO-CIRC-"
                                            + stableToken(cycleKey),
                                    AlertEntity.AlertType.CIRCULAR_FLOW,
                                    AlertEntity.AlertSeverity.CRITICAL,
                                    96,
                                    "Circular money flow detected",
                                    "Three accounts formed a closed transfer cycle "
                                            + "within "
                                            + cycleDuration.toMinutes()
                                            + " minutes, returning funds to "
                                            + "the originating relationship.",
                                    primaryAccount,
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
            List<TransactionEntity> transactions
    ) {
        Map<String, List<TransactionEntity>> grouped =
                new HashMap<>();

        for (TransactionEntity transaction : transactions) {

            if (transaction
                    .getAmount()
                    .compareTo(STRUCTURING_MIN) < 0) {
                continue;
            }

            if (transaction
                    .getAmount()
                    .compareTo(STRUCTURING_MAX) >= 0) {
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
                            ignored -> new ArrayList<>()
                    )
                    .add(transaction);
        }

        List<DetectionCandidate> results =
                new ArrayList<>();

        for (
                Map.Entry<String, List<TransactionEntity>>
                        entry : grouped.entrySet()
        ) {
            List<TransactionEntity> group =
                    entry
                            .getValue()
                            .stream()
                            .sorted(
                                    Comparator.comparing(
                                            TransactionEntity::getOccurredAt
                                    )
                            )
                            .toList();

            if (group.size() < 3) {
                continue;
            }

            Duration span =
                    Duration.between(
                            group.getFirst().getOccurredAt(),
                            group.getLast().getOccurredAt()
                    );

            if (span.compareTo(Duration.ofHours(2)) > 0) {
                continue;
            }

            BigDecimal total =
                    group
                            .stream()
                            .map(TransactionEntity::getAmount)
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            if (total.compareTo(STRUCTURING_TOTAL) < 0) {
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

            String detectionKey =
                    sourceAccount
                            + "|"
                            + destinationAccount;

            results.add(
                    new DetectionCandidate(
                            "AUTO-STRUCT-"
                                    + stableToken(detectionKey),
                            AlertEntity.AlertType.STRUCTURING,
                            AlertEntity.AlertSeverity.HIGH,
                            88,
                            "Possible structuring pattern detected",
                            group.size()
                                    + " transfers totaling "
                                    + total
                                    + " were sent between the same "
                                    + "accounts within "
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
            List<TransactionEntity> transactions
    ) {
        List<DetectionCandidate> results =
                new ArrayList<>();

        for (TransactionEntity transaction : transactions) {

            if (transaction
                    .getAmount()
                    .compareTo(LARGE_CROSS_BORDER) < 0) {
                continue;
            }

            if (!isCrossBorder(transaction)) {
                continue;
            }

            results.add(
                    new DetectionCandidate(
                            "AUTO-XB-"
                                    + stableToken(
                                            transaction.getReference()
                                    ),
                            AlertEntity.AlertType.LARGE_CROSS_BORDER,
                            AlertEntity.AlertSeverity.HIGH,
                            84,
                            "Large cross-border transfer detected",
                            "A "
                                    + transaction.getAmount()
                                    + " "
                                    + transaction.getCurrency()
                                    + " transfer crossed customer "
                                    + "jurisdictions and exceeded the "
                                    + "large-transfer monitoring threshold.",
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

    private List<DetectionCandidate> detectHighRiskCounterparties(
            List<TransactionEntity> transactions
    ) {
        List<DetectionCandidate> results =
                new ArrayList<>();

        for (TransactionEntity transaction : transactions) {

            if (transaction
                    .getAmount()
                    .compareTo(HIGH_RISK_EXPOSURE) < 0) {
                continue;
            }

            if (!isCrossBorder(transaction)) {
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

            if (sourceCustomer.getRiskTier()
                    != CustomerEntity.RiskTier.HIGH
                    && destinationCustomer.getRiskTier()
                    != CustomerEntity.RiskTier.HIGH) {
                continue;
            }

            results.add(
                    new DetectionCandidate(
                            "AUTO-HRCP-"
                                    + stableToken(
                                            transaction.getReference()
                                    ),
                            AlertEntity.AlertType.HIGH_RISK_COUNTERPARTY,
                            AlertEntity.AlertSeverity.HIGH,
                            79,
                            "High-risk counterparty exposure",
                            "A material cross-border transfer involved "
                                    + "at least one customer relationship "
                                    + "classified as high risk.",
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

    private List<DetectionCandidate> detectVelocityAnomalies(
            List<TransactionEntity> transactions
    ) {
        Map<String, List<TransactionEntity>> byAccount =
                new HashMap<>();

        for (TransactionEntity transaction : transactions) {

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
                            ignored -> new ArrayList<>()
                    )
                    .add(transaction);

            if (!source.equals(destination)) {
                byAccount
                        .computeIfAbsent(
                                destination,
                                ignored -> new ArrayList<>()
                        )
                        .add(transaction);
            }
        }

        List<DetectionCandidate> results =
                new ArrayList<>();

        for (
                Map.Entry<String, List<TransactionEntity>>
                        entry : byAccount.entrySet()
        ) {
            List<TransactionEntity> activity =
                    entry
                            .getValue()
                            .stream()
                            .sorted(
                                    Comparator.comparing(
                                            TransactionEntity::getOccurredAt
                                    )
                            )
                            .toList();

            boolean detected = false;

            for (
                    int start = 0;
                    start < activity.size() && !detected;
                    start++
            ) {
                for (
                        int end = start + 3;
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

                    if (window.compareTo(
                            Duration.ofHours(3)
                    ) <= 0) {

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
                                        AlertEntity.AlertSeverity.MEDIUM,
                                        72,
                                        "Transaction velocity anomaly",
                                        "At least four account interactions "
                                                + "occurred inside a three-hour "
                                                + "monitoring window.",
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

        return !sourceCountry.equals(destinationCountry);
    }

    private String stableToken(String value) {
        return UUID
                .nameUUIDFromBytes(
                        value.getBytes(StandardCharsets.UTF_8)
                )
                .toString()
                .substring(0, 8)
                .toUpperCase(Locale.ROOT);
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
}
