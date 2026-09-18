package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionRiskScoringServiceTest {

    private final TransactionRiskScoringService service =
            new TransactionRiskScoringService();

    @Test
    void shouldAssignElevatedScoreToLargeCrossBorderWire() {
        CustomerEntity sourceCustomer = customer(
                "Source",
                "FR",
                CustomerEntity.RiskTier.HIGH
        );

        CustomerEntity destinationCustomer = customer(
                "Destination",
                "TN",
                CustomerEntity.RiskTier.HIGH
        );

        AccountEntity source = account(
                "TEST-001",
                sourceCustomer
        );

        AccountEntity destination = account(
                "TEST-002",
                destinationCustomer
        );

        TransactionEntity transaction =
                new TransactionEntity(
                        UUID.randomUUID(),
                        "TEST-TXN-001",
                        source,
                        destination,
                        new BigDecimal("30000"),
                        "EUR",
                        Instant.now(),
                        TransactionEntity.TransactionChannel.WIRE,
                        "TN",
                        TransactionEntity.TransactionStatus.REVIEW
                );

        TransactionRiskScoringService.RiskAssessment result =
                service.assess(transaction);

        assertThat(result.score()).isGreaterThanOrEqualTo(80);

        assertThat(result.reasons())
                .contains(
                        "Large transaction amount",
                        "High-risk source customer",
                        "High-risk destination customer",
                        "Cross-border relationship",
                        "Wire transfer"
                );
    }

    @Test
    void shouldKeepLowRiskDomesticTransferLow() {
        CustomerEntity sourceCustomer = customer(
                "Source",
                "FR",
                CustomerEntity.RiskTier.LOW
        );

        CustomerEntity destinationCustomer = customer(
                "Destination",
                "FR",
                CustomerEntity.RiskTier.LOW
        );

        AccountEntity source = account(
                "TEST-003",
                sourceCustomer
        );

        AccountEntity destination = account(
                "TEST-004",
                destinationCustomer
        );

        TransactionEntity transaction =
                new TransactionEntity(
                        UUID.randomUUID(),
                        "TEST-TXN-002",
                        source,
                        destination,
                        new BigDecimal("250"),
                        "EUR",
                        Instant.now(),
                        TransactionEntity.TransactionChannel.CARD,
                        "FR",
                        TransactionEntity.TransactionStatus.SETTLED
                );

        TransactionRiskScoringService.RiskAssessment result =
                service.assess(transaction);

        assertThat(result.score()).isEqualTo(5);
        assertThat(result.reasons()).isEmpty();
    }

    private CustomerEntity customer(
            String name,
            String country,
            CustomerEntity.RiskTier riskTier
    ) {
        return new CustomerEntity(
                UUID.randomUUID(),
                UUID.randomUUID().toString(),
                name,
                country,
                riskTier,
                Instant.now()
        );
    }

    private AccountEntity account(
            String number,
            CustomerEntity customer
    ) {
        return new AccountEntity(
                UUID.randomUUID(),
                number,
                AccountEntity.AccountType.CHECKING,
                "EUR",
                BigDecimal.ZERO,
                AccountEntity.AccountStatus.ACTIVE,
                customer,
                Instant.now()
        );
    }
}
