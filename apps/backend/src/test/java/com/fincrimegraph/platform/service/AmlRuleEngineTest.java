package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class AmlRuleEngineTest {

    private final AmlRuleEngine ruleEngine =
            new AmlRuleEngine();

    @Test
    void detectsCircularThreeHopFlow() {
        Instant base = Instant.parse(
                "2026-09-18T10:00:00Z"
        );

        AccountEntity a =
                account("TEST-A", "FR", true);

        AccountEntity b =
                account("TEST-B", "DE", false);

        AccountEntity c =
                account("TEST-C", "TN", true);

        List<TransactionEntity> transactions =
                List.of(
                        transaction(
                                "CYCLE-1",
                                a,
                                b,
                                "9500",
                                base
                        ),
                        transaction(
                                "CYCLE-2",
                                b,
                                c,
                                "9400",
                                base.plus(
                                        10,
                                        ChronoUnit.MINUTES
                                )
                        ),
                        transaction(
                                "CYCLE-3",
                                c,
                                a,
                                "9300",
                                base.plus(
                                        20,
                                        ChronoUnit.MINUTES
                                )
                        )
                );

        List<AmlRuleEngine.DetectionCandidate> candidates =
                ruleEngine.evaluate(transactions);

        assertThat(candidates)
                .extracting(
                        AmlRuleEngine
                                .DetectionCandidate::type
                )
                .contains(
                        AlertEntity.AlertType.CIRCULAR_FLOW
                );
    }

    @Test
    void detectsStructuringCluster() {
        Instant base = Instant.parse(
                "2026-09-18T10:00:00Z"
        );

        AccountEntity source =
                account("TEST-SOURCE", "FR", false);

        AccountEntity destination =
                account("TEST-DEST", "FR", false);

        List<TransactionEntity> transactions =
                List.of(
                        transaction(
                                "STRUCT-1",
                                source,
                                destination,
                                "4800",
                                base
                        ),
                        transaction(
                                "STRUCT-2",
                                source,
                                destination,
                                "4900",
                                base.plus(
                                        15,
                                        ChronoUnit.MINUTES
                                )
                        ),
                        transaction(
                                "STRUCT-3",
                                source,
                                destination,
                                "4700",
                                base.plus(
                                        30,
                                        ChronoUnit.MINUTES
                                )
                        )
                );

        List<AmlRuleEngine.DetectionCandidate> candidates =
                ruleEngine.evaluate(transactions);

        assertThat(candidates)
                .extracting(
                        AmlRuleEngine
                                .DetectionCandidate::type
                )
                .contains(
                        AlertEntity.AlertType.STRUCTURING
                );
    }

    @Test
    void detectsLargeCrossBorderTransfer() {
        AccountEntity source =
                account("TEST-FR", "FR", true);

        AccountEntity destination =
                account("TEST-AE", "AE", true);

        TransactionEntity transaction =
                transaction(
                        "XB-1",
                        source,
                        destination,
                        "30000",
                        Instant.parse(
                                "2026-09-18T10:00:00Z"
                        )
                );

        List<AmlRuleEngine.DetectionCandidate> candidates =
                ruleEngine.evaluate(
                        List.of(transaction)
                );

        assertThat(candidates)
                .extracting(
                        AmlRuleEngine
                                .DetectionCandidate::type
                )
                .contains(
                        AlertEntity.AlertType
                                .LARGE_CROSS_BORDER,
                        AlertEntity.AlertType
                                .HIGH_RISK_COUNTERPARTY
                );
    }

    private AccountEntity account(
            String accountNumber,
            String country,
            boolean highRisk
    ) {
        CustomerEntity customer =
                new CustomerEntity(
                        UUID.randomUUID(),
                        UUID.randomUUID().toString(),
                        "Test Customer",
                        country,
                        highRisk
                                ? CustomerEntity.RiskTier.HIGH
                                : CustomerEntity.RiskTier.LOW,
                        Instant.now()
                );

        return new AccountEntity(
                UUID.randomUUID(),
                accountNumber,
                AccountEntity.AccountType.CHECKING,
                "EUR",
                new BigDecimal("50000"),
                AccountEntity.AccountStatus.ACTIVE,
                customer,
                Instant.now()
        );
    }

    private TransactionEntity transaction(
            String reference,
            AccountEntity source,
            AccountEntity destination,
            String amount,
            Instant occurredAt
    ) {
        return new TransactionEntity(
                UUID.randomUUID(),
                reference,
                source,
                destination,
                new BigDecimal(amount),
                "EUR",
                occurredAt,
                TransactionEntity.TransactionChannel.WIRE,
                destination
                        .getCustomer()
                        .getCountryCode(),
                TransactionEntity.TransactionStatus.SETTLED
        );
    }
}
