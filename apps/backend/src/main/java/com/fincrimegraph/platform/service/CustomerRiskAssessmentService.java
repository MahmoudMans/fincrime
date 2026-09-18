package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.CustomerRiskAssessmentEntity;
import com.fincrimegraph.platform.domain.CustomerRiskFactorEntity;
import com.fincrimegraph.platform.domain.ScreeningHitEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.CustomerRepository;
import com.fincrimegraph.platform.repository.CustomerRiskAssessmentRepository;
import com.fincrimegraph.platform.repository.CustomerRiskFactorRepository;
import com.fincrimegraph.platform.repository.ScreeningHitRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class CustomerRiskAssessmentService {

    private static final Duration
            CIRCULAR_WINDOW =
            Duration.ofMinutes(
                    90
            );

    private final CustomerRepository customerRepository;
    private final TransactionRepository transactionRepository;
    private final ScreeningHitRepository screeningHitRepository;
    private final CustomerRiskAssessmentRepository assessmentRepository;
    private final CustomerRiskFactorRepository factorRepository;
    private final CustomerRiskScorer scorer;

    public CustomerRiskAssessmentService(
            CustomerRepository customerRepository,
            TransactionRepository transactionRepository,
            ScreeningHitRepository screeningHitRepository,
            CustomerRiskAssessmentRepository assessmentRepository,
            CustomerRiskFactorRepository factorRepository,
            CustomerRiskScorer scorer
    ) {
        this.customerRepository =
                customerRepository;

        this.transactionRepository =
                transactionRepository;

        this.screeningHitRepository =
                screeningHitRepository;

        this.assessmentRepository =
                assessmentRepository;

        this.factorRepository =
                factorRepository;

        this.scorer =
                scorer;
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public RiskBatchView recalculate(
            String generatedBy
    ) {
        String actor =
                requireText(
                        generatedBy,
                        "generatedBy"
                );

        List<CustomerEntity> customers =
                customerRepository
                        .findAll();

        List<TransactionEntity> transactions =
                transactionRepository
                        .findAll();

        List<ScreeningHitEntity> screeningHits =
                screeningHitRepository
                        .findAll();

        Set<String> circularAccounts =
                circularAccounts(
                        transactions
                );

        UUID batchId =
                UUID.randomUUID();

        Instant generatedAt =
                Instant.now();

        List<CustomerRiskAssessmentEntity>
                savedAssessments =
                new ArrayList<>();

        for (
                CustomerEntity customer
                        : customers
        ) {
            UUID customerId =
                    customer.getId();

            List<TransactionEntity>
                    customerTransactions =
                    transactions
                            .stream()
                            .filter(
                                    transaction ->
                                            involved(
                                                    customerId,
                                                    transaction
                                            )
                            )
                            .toList();

            BigDecimal totalVolume =
                    customerTransactions
                            .stream()
                            .map(
                                    TransactionEntity
                                            ::getAmount
                            )
                            .reduce(
                                    BigDecimal.ZERO,
                                    BigDecimal::add
                            );

            int crossBorderCount =
                    (int)
                            customerTransactions
                                    .stream()
                                    .filter(
                                            this::crossBorder
                                    )
                                    .count();

            int highRiskCounterpartyCount =
                    (int)
                            customerTransactions
                                    .stream()
                                    .filter(
                                            transaction ->
                                                    hasHighRiskCounterparty(
                                                            customerId,
                                                            transaction
                                                    )
                                    )
                                    .count();

            boolean circularParticipant =
                    customerTransactions
                            .stream()
                            .anyMatch(
                                    transaction ->
                                            circularAccounts
                                                    .contains(
                                                            customerAccountNumber(
                                                                    customerId,
                                                                    transaction
                                                            )
                                                    )
                            );

            List<ScreeningHitEntity>
                    customerHits =
                    screeningHits
                            .stream()
                            .filter(
                                    hit ->
                                            customerId
                                                    .equals(
                                                            hit
                                                                    .getCustomer()
                                                                    .getId()
                                                    )
                            )
                            .toList();

            int maxWatchlistScore =
                    customerHits
                            .stream()
                            .mapToInt(
                                    ScreeningHitEntity
                                            ::getMatchScore
                            )
                            .max()
                            .orElse(
                                    0
                            );

            String reviewState =
                    watchlistReviewState(
                            customerHits
                    );

            CustomerRiskScorer.RiskScore
                    result =
                    scorer.score(
                            new CustomerRiskScorer.RiskInput(
                                    customer
                                            .getRiskTier()
                                            .name(),
                                    customerHits.size(),
                                    maxWatchlistScore,
                                    reviewState,
                                    customerTransactions.size(),
                                    totalVolume,
                                    crossBorderCount,
                                    highRiskCounterpartyCount,
                                    circularParticipant
                            )
                    );

            CustomerRiskAssessmentEntity
                    assessment =
                    assessmentRepository
                            .save(
                                    new CustomerRiskAssessmentEntity(
                                            UUID.randomUUID(),
                                            batchId,
                                            customer,
                                            result.score(),
                                            result.riskBand(),
                                            CustomerRiskScorer
                                                    .MODEL_VERSION,
                                            actor,
                                            generatedAt
                                    )
                            );

            for (
                    CustomerRiskScorer.Factor
                            factor
                            : result.factors()
            ) {
                factorRepository
                        .save(
                                new CustomerRiskFactorEntity(
                                        UUID.randomUUID(),
                                        assessment,
                                        factor.factorKey(),
                                        factor.label(),
                                        factor.rawValue(),
                                        factor.contribution(),
                                        factor.explanation(),
                                        generatedAt
                                )
                        );
            }

            savedAssessments.add(
                    assessment
            );
        }

        List<AssessmentView> views =
                savedAssessments
                        .stream()
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                CustomerRiskAssessmentEntity
                                                        ::getScore
                                        )
                                        .reversed()
                                        .thenComparing(
                                                item ->
                                                        item
                                                                .getCustomer()
                                                                .getFullName()
                                        )
                        )
                        .map(
                                this::toView
                        )
                        .toList();

        return new RiskBatchView(
                batchId.toString(),
                CustomerRiskScorer
                        .MODEL_VERSION,
                generatedAt,
                views.size(),
                countBand(
                        views,
                        "LOW"
                ),
                countBand(
                        views,
                        "MEDIUM"
                ),
                countBand(
                        views,
                        "HIGH"
                ),
                countBand(
                        views,
                        "CRITICAL"
                ),
                views
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<AssessmentView>
    latestAssessments() {

        Map<UUID, CustomerRiskAssessmentEntity>
                latest =
                new LinkedHashMap<>();

        for (
                CustomerRiskAssessmentEntity
                        assessment
                        : assessmentRepository
                        .findAllByOrderByGeneratedAtDesc()
        ) {
            latest.putIfAbsent(
                    assessment
                            .getCustomer()
                            .getId(),
                    assessment
            );
        }

        return latest
                .values()
                .stream()
                .sorted(
                        Comparator
                                .comparingInt(
                                        CustomerRiskAssessmentEntity
                                                ::getScore
                                )
                                .reversed()
                                .thenComparing(
                                        item ->
                                                item
                                                        .getCustomer()
                                                        .getFullName()
                                )
                )
                .map(
                        this::toView
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<AssessmentView>
    history(
            UUID customerId
    ) {
        if (
                !customerRepository
                        .existsById(
                                customerId
                        )
        ) {
            throw new IllegalArgumentException(
                    "Customer not found: "
                            + customerId
            );
        }

        return assessmentRepository
                .findByCustomer_IdOrderByGeneratedAtDesc(
                        customerId
                )
                .stream()
                .map(
                        this::toView
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<FactorView> factors(
            UUID assessmentId
    ) {
        assessmentRepository
                .findById(
                        assessmentId
                )
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Risk assessment not found: "
                                                + assessmentId
                                )
                );

        return factorRepository
                .findByAssessment_IdOrderByContributionDescFactorKeyAsc(
                        assessmentId
                )
                .stream()
                .map(
                        factor ->
                                new FactorView(
                                        factor
                                                .getId()
                                                .toString(),
                                        factor
                                                .getFactorKey(),
                                        factor
                                                .getLabel(),
                                        factor
                                                .getRawValue(),
                                        factor
                                                .getContribution(),
                                        factor
                                                .getExplanation()
                                )
                )
                .toList();
    }

    private int countBand(
            List<AssessmentView> assessments,
            String band
    ) {
        return (int)
                assessments
                        .stream()
                        .filter(
                                assessment ->
                                        band.equals(
                                                assessment
                                                        .riskBand()
                                        )
                        )
                        .count();
    }

    private boolean involved(
            UUID customerId,
            TransactionEntity transaction
    ) {
        return customerId.equals(
                transaction
                        .getSourceAccount()
                        .getCustomer()
                        .getId()
        )
                || customerId.equals(
                transaction
                        .getDestinationAccount()
                        .getCustomer()
                        .getId()
        );
    }

    private boolean crossBorder(
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

        if (
                sourceCountry == null
                        || destinationCountry == null
        ) {
            return false;
        }

        return !sourceCountry
                .equalsIgnoreCase(
                        destinationCountry
                );
    }

    private boolean hasHighRiskCounterparty(
            UUID customerId,
            TransactionEntity transaction
    ) {
        CustomerEntity source =
                transaction
                        .getSourceAccount()
                        .getCustomer();

        CustomerEntity destination =
                transaction
                        .getDestinationAccount()
                        .getCustomer();

        if (
                customerId.equals(
                        source.getId()
                )
        ) {
            return "HIGH".equals(
                    destination
                            .getRiskTier()
                            .name()
            );
        }

        if (
                customerId.equals(
                        destination.getId()
                )
        ) {
            return "HIGH".equals(
                    source
                            .getRiskTier()
                            .name()
            );
        }

        return false;
    }

    private String customerAccountNumber(
            UUID customerId,
            TransactionEntity transaction
    ) {
        AccountEntity source =
                transaction
                        .getSourceAccount();

        if (
                customerId.equals(
                        source
                                .getCustomer()
                                .getId()
                )
        ) {
            return source
                    .getAccountNumber();
        }

        return transaction
                .getDestinationAccount()
                .getAccountNumber();
    }

    private Set<String> circularAccounts(
            List<TransactionEntity> transactions
    ) {
        Set<String> accounts =
                new LinkedHashSet<>();

        for (
                TransactionEntity first
                        : transactions
        ) {
            for (
                    TransactionEntity second
                            : transactions
            ) {
                if (
                        !first
                                .getDestinationAccount()
                                .getId()
                                .equals(
                                        second
                                                .getSourceAccount()
                                                .getId()
                                )
                ) {
                    continue;
                }

                if (
                        !second
                                .getOccurredAt()
                                .isAfter(
                                        first
                                                .getOccurredAt()
                                )
                ) {
                    continue;
                }

                for (
                        TransactionEntity third
                                : transactions
                ) {
                    if (
                            !second
                                    .getDestinationAccount()
                                    .getId()
                                    .equals(
                                            third
                                                    .getSourceAccount()
                                                    .getId()
                                    )
                    ) {
                        continue;
                    }

                    if (
                            !third
                                    .getDestinationAccount()
                                    .getId()
                                    .equals(
                                            first
                                                    .getSourceAccount()
                                                    .getId()
                                    )
                    ) {
                        continue;
                    }

                    if (
                            !third
                                    .getOccurredAt()
                                    .isAfter(
                                            second
                                                    .getOccurredAt()
                                    )
                    ) {
                        continue;
                    }

                    Duration duration =
                            Duration.between(
                                    first
                                            .getOccurredAt(),
                                    third
                                            .getOccurredAt()
                            );

                    if (
                            duration.isNegative()
                                    || duration
                                    .compareTo(
                                            CIRCULAR_WINDOW
                                    ) > 0
                    ) {
                        continue;
                    }

                    accounts.add(
                            first
                                    .getSourceAccount()
                                    .getAccountNumber()
                    );

                    accounts.add(
                            first
                                    .getDestinationAccount()
                                    .getAccountNumber()
                    );

                    accounts.add(
                            second
                                    .getDestinationAccount()
                                    .getAccountNumber()
                    );
                }
            }
        }

        return accounts;
    }

    private String watchlistReviewState(
            List<ScreeningHitEntity> hits
    ) {
        if (
                hits.stream()
                        .anyMatch(
                                hit ->
                                        hit.getStatus()
                                                ==
                                                ScreeningHitEntity
                                                        .ReviewStatus
                                                        .ESCALATED
                        )
        ) {
            return "ESCALATED";
        }

        if (
                hits.stream()
                        .anyMatch(
                                hit ->
                                        hit.getStatus()
                                                ==
                                                ScreeningHitEntity
                                                        .ReviewStatus
                                                        .PENDING_REVIEW
                        )
        ) {
            return "PENDING_REVIEW";
        }

        if (
                !hits.isEmpty()
        ) {
            return "CLEARED";
        }

        return "NONE";
    }

    private AssessmentView toView(
            CustomerRiskAssessmentEntity assessment
    ) {
        CustomerEntity customer =
                assessment
                        .getCustomer();

        return new AssessmentView(
                assessment
                        .getId()
                        .toString(),
                assessment
                        .getBatchId()
                        .toString(),
                customer
                        .getId()
                        .toString(),
                customer
                        .getFullName(),
                customer
                        .getCountryCode(),
                customer
                        .getRiskTier()
                        .name(),
                assessment
                        .getScore(),
                assessment
                        .getRiskBand()
                        .name(),
                assessment
                        .getModelVersion(),
                assessment
                        .getGeneratedBy(),
                assessment
                        .getGeneratedAt()
        );
    }

    private String requireText(
            String value,
            String field
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

        return value.trim();
    }

    public record AssessmentView(
            String id,
            String batchId,
            String customerId,
            String customerName,
            String countryCode,
            String customerRiskTier,
            int score,
            String riskBand,
            String modelVersion,
            String generatedBy,
            Instant generatedAt
    ) {
    }

    public record FactorView(
            String id,
            String factorKey,
            String label,
            String rawValue,
            int contribution,
            String explanation
    ) {
    }

    public record RiskBatchView(
            String batchId,
            String modelVersion,
            Instant generatedAt,
            int customerCount,
            int lowCount,
            int mediumCount,
            int highCount,
            int criticalCount,
            List<AssessmentView> assessments
    ) {
    }
}
