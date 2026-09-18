package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.DetectionRunEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.AccountRepository;
import com.fincrimegraph.platform.repository.AlertRepository;
import com.fincrimegraph.platform.repository.DetectionRunRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AmlDetectionService {

    private final AmlRuleEngine ruleEngine;
    private final TransactionRepository transactionRepository;
    private final AccountRepository accountRepository;
    private final AlertRepository alertRepository;
    private final DetectionRunRepository detectionRunRepository;
    private DetectionRuleService detectionRuleService;

    public AmlDetectionService(
            AmlRuleEngine ruleEngine,
            TransactionRepository transactionRepository,
            AccountRepository accountRepository,
            AlertRepository alertRepository,
            DetectionRunRepository detectionRunRepository
    ) {
        this.ruleEngine = ruleEngine;
        this.transactionRepository = transactionRepository;
        this.accountRepository = accountRepository;
        this.alertRepository = alertRepository;
        this.detectionRunRepository = detectionRunRepository;
    }

    @org.springframework.beans.factory.annotation.Autowired
    void setDetectionRuleService(
            DetectionRuleService detectionRuleService
    ) {
        this.detectionRuleService =
                detectionRuleService;
    }


    @Transactional(transactionManager = "transactionManager")
    public DetectionRunView runDetection() {

        Instant startedAt = Instant.now();

        DetectionRunEntity run =
                detectionRunRepository.save(
                        new DetectionRunEntity(
                                UUID.randomUUID(),
                                startedAt
                        )
                );

        List<TransactionEntity> transactions =
                transactionRepository.findAll();

        AmlRuleEngine.RuleConfiguration configuration =
                detectionRuleService == null
                        ? AmlRuleEngine.RuleConfiguration.defaults()
                        : detectionRuleService
                        .runtimeConfiguration();

        List<AmlRuleEngine.DetectionCandidate> candidates =
                ruleEngine.evaluate(
                        transactions,
                        configuration
                );

        int created = 0;
        int existing = 0;

        for (
                AmlRuleEngine.DetectionCandidate candidate
                        : candidates
        ) {
            if (alertRepository.existsByAlertCode(
                    candidate.alertCode()
            )) {
                existing++;
                continue;
            }

            AccountEntity account =
                    accountRepository
                            .findByAccountNumber(
                                    candidate
                                            .primaryAccountNumber()
                            )
                            .orElseThrow(
                                    () -> new IllegalStateException(
                                            "Detection account not found: "
                                                    + candidate
                                                            .primaryAccountNumber()
                                    )
                            );

            TransactionEntity transaction =
                    transactionRepository
                            .findByReference(
                                    candidate
                                            .transactionReference()
                            )
                            .orElse(null);

            AlertEntity alert =
                    new AlertEntity(
                            deterministicId(
                                    "auto-alert:"
                                            + candidate.alertCode()
                            ),
                            candidate.alertCode(),
                            candidate.type(),
                            candidate.severity(),
                            candidate.riskScore(),
                            AlertEntity.AlertStatus.OPEN,
                            candidate.title(),
                            candidate.description()
                                    + " Rule: "
                                    + candidate.ruleId()
                                    + ".",
                            account,
                            transaction,
                            Instant.now()
                    );

            alertRepository.save(alert);
            created++;
        }

        run.complete(
                Instant.now(),
                configuration.enabledCount(),
                candidates.size(),
                created,
                existing
        );

        detectionRunRepository.save(run);

        return toView(run);
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<DetectionRunView> recentRuns() {
        return detectionRunRepository
                .findTop5ByOrderByStartedAtDesc()
                .stream()
                .map(this::toView)
                .toList();
    }

    private DetectionRunView toView(
            DetectionRunEntity run
    ) {
        return new DetectionRunView(
                run.getId().toString(),
                run.getStatus().name(),
                run.getStartedAt(),
                run.getCompletedAt(),
                run.getRulesExecuted(),
                run.getCandidatesFound(),
                run.getAlertsCreated(),
                run.getAlertsExisting()
        );
    }

    private UUID deterministicId(String value) {
        return UUID.nameUUIDFromBytes(
                value.getBytes(StandardCharsets.UTF_8)
        );
    }

    public record DetectionRunView(
            String id,
            String status,
            Instant startedAt,
            Instant completedAt,
            int rulesExecuted,
            int candidatesFound,
            int alertsCreated,
            int alertsExisting
    ) {
    }
}
