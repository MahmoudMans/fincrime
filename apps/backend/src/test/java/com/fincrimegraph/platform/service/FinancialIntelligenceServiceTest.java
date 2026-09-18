package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.AccountRepository;
import com.fincrimegraph.platform.repository.AlertRepository;
import com.fincrimegraph.platform.repository.CustomerRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FinancialIntelligenceServiceTest {

    @Test
    void transactionExplorerFiltersAndAddsRiskAssessment() {

        CustomerRepository customerRepository =
                mock(CustomerRepository.class);

        AccountRepository accountRepository =
                mock(AccountRepository.class);

        TransactionRepository transactionRepository =
                mock(TransactionRepository.class);

        AlertRepository alertRepository =
                mock(AlertRepository.class);

        TransactionRiskScoringService riskScoringService =
                new TransactionRiskScoringService();

        CustomerEntity sourceCustomer =
                customer(
                        "Nadia Test",
                        "FR",
                        CustomerEntity.RiskTier.HIGH
                );

        CustomerEntity destinationCustomer =
                customer(
                        "Daniel Test",
                        "GH",
                        CustomerEntity.RiskTier.HIGH
                );

        AccountEntity source =
                account(
                        "TEST-SOURCE",
                        sourceCustomer
                );

        AccountEntity destination =
                account(
                        "TEST-DESTINATION",
                        destinationCustomer
                );

        TransactionEntity wire =
                transaction(
                        "WIRE-001",
                        source,
                        destination,
                        "30000",
                        TransactionEntity
                                .TransactionChannel
                                .WIRE
                );

        TransactionEntity card =
                transaction(
                        "CARD-001",
                        source,
                        destination,
                        "100",
                        TransactionEntity
                                .TransactionChannel
                                .CARD
                );

        when(
                transactionRepository.findAll()
        ).thenReturn(
                List.of(wire, card)
        );

        FinancialIntelligenceService service =
                new FinancialIntelligenceService(
                        customerRepository,
                        accountRepository,
                        transactionRepository,
                        alertRepository,
                        riskScoringService
                );

        List<
                FinancialIntelligenceService
                        .TransactionExplorerItem
                > results =
                service.transactions(
                        null,
                        "WIRE",
                        null,
                        new BigDecimal("10000"),
                        null
                );

        assertThat(results)
                .hasSize(1);

        assertThat(
                results.getFirst().reference()
        ).isEqualTo("WIRE-001");

        assertThat(
                results.getFirst().riskScore()
        ).isGreaterThanOrEqualTo(80);

        assertThat(
                results.getFirst().riskReasons()
        ).contains(
                "Large transaction amount",
                "Cross-border relationship",
                "Wire transfer"
        );
    }

    private CustomerEntity customer(
            String name,
            String country,
            CustomerEntity.RiskTier risk
    ) {
        return new CustomerEntity(
                UUID.randomUUID(),
                UUID.randomUUID().toString(),
                name,
                country,
                risk,
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
            TransactionEntity.TransactionChannel channel
    ) {
        return new TransactionEntity(
                UUID.randomUUID(),
                reference,
                source,
                destination,
                new BigDecimal(amount),
                "EUR",
                Instant.now(),
                channel,
                destination
                        .getCustomer()
                        .getCountryCode(),
                TransactionEntity.TransactionStatus.SETTLED
        );
    }
}
