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

class AmlRuleConfigurationTest {

    private final AmlRuleEngine engine =
            new AmlRuleEngine();

    @Test
    void disabledVelocityRuleDoesNotGenerateCandidate() {

        Instant base =
                Instant.parse(
                        "2026-09-18T10:00:00Z"
                );

        /*
         * TEST-A has four interactions inside one hour.
         *
         * Each counterparty has only one interaction.
         *
         * Therefore the enabled velocity rule must produce
         * exactly one account-level anomaly for TEST-A.
         */
        AccountEntity monitoredAccount =
                account(
                        "TEST-A"
                );

        AccountEntity counterpartyB =
                account(
                        "TEST-B"
                );

        AccountEntity counterpartyC =
                account(
                        "TEST-C"
                );

        AccountEntity counterpartyD =
                account(
                        "TEST-D"
                );

        AccountEntity counterpartyE =
                account(
                        "TEST-E"
                );

        List<TransactionEntity> transactions =
                List.of(
                        transaction(
                                "VEL-1",
                                monitoredAccount,
                                counterpartyB,
                                base
                        ),
                        transaction(
                                "VEL-2",
                                monitoredAccount,
                                counterpartyC,
                                base.plus(
                                        20,
                                        ChronoUnit.MINUTES
                                )
                        ),
                        transaction(
                                "VEL-3",
                                monitoredAccount,
                                counterpartyD,
                                base.plus(
                                        40,
                                        ChronoUnit.MINUTES
                                )
                        ),
                        transaction(
                                "VEL-4",
                                monitoredAccount,
                                counterpartyE,
                                base.plus(
                                        60,
                                        ChronoUnit.MINUTES
                                )
                        )
                );

        AmlRuleEngine.RuleConfiguration defaults =
                AmlRuleEngine
                        .RuleConfiguration
                        .defaults();

        AmlRuleEngine.RuleConfiguration disabled =
                new AmlRuleEngine.RuleConfiguration(
                        defaults
                                .circularFlow()
                                .withEnabled(
                                        false
                                ),
                        defaults
                                .structuring()
                                .withEnabled(
                                        false
                                ),
                        defaults
                                .largeCrossBorder()
                                .withEnabled(
                                        false
                                ),
                        defaults
                                .highRiskCounterparty()
                                .withEnabled(
                                        false
                                ),
                        defaults
                                .velocityAnomaly()
                                .withEnabled(
                                        false
                                )
                );

        assertThat(
                engine.evaluate(
                        transactions,
                        disabled
                )
        ).isEmpty();

        AmlRuleEngine.RuleConfiguration
                velocityOnly =
                new AmlRuleEngine.RuleConfiguration(
                        disabled.circularFlow(),
                        disabled.structuring(),
                        disabled.largeCrossBorder(),
                        disabled.highRiskCounterparty(),
                        defaults.velocityAnomaly()
                );

        List<
                AmlRuleEngine.DetectionCandidate
                > candidates =
                engine.evaluate(
                        transactions,
                        velocityOnly
                );

        assertThat(
                candidates
        ).hasSize(1);

        assertThat(
                candidates
        )
                .extracting(
                        AmlRuleEngine
                                .DetectionCandidate
                                ::type
                )
                .containsExactly(
                        AlertEntity
                                .AlertType
                                .VELOCITY_ANOMALY
                );

        assertThat(
                candidates
        )
                .extracting(
                        AmlRuleEngine
                                .DetectionCandidate
                                ::primaryAccountNumber
                )
                .containsExactly(
                        "TEST-A"
                );

        assertThat(
                candidates
        )
                .extracting(
                        AmlRuleEngine
                                .DetectionCandidate
                                ::ruleId
                )
                .containsExactly(
                        "TRANSACTION_VELOCITY"
                );
    }

    private AccountEntity account(
            String number
    ) {
        CustomerEntity customer =
                new CustomerEntity(
                        UUID.randomUUID(),
                        UUID.randomUUID()
                                .toString(),
                        "Velocity Customer "
                                + number,
                        "FR",
                        CustomerEntity
                                .RiskTier
                                .LOW,
                        Instant.now()
                );

        return new AccountEntity(
                UUID.randomUUID(),
                number,
                AccountEntity
                        .AccountType
                        .CHECKING,
                "EUR",
                new BigDecimal(
                        "50000"
                ),
                AccountEntity
                        .AccountStatus
                        .ACTIVE,
                customer,
                Instant.now()
        );
    }

    private TransactionEntity transaction(
            String reference,
            AccountEntity source,
            AccountEntity destination,
            Instant occurredAt
    ) {
        return new TransactionEntity(
                UUID.randomUUID(),
                reference,
                source,
                destination,
                new BigDecimal(
                        "100"
                ),
                "EUR",
                occurredAt,
                TransactionEntity
                        .TransactionChannel
                        .CARD,
                "FR",
                TransactionEntity
                        .TransactionStatus
                        .SETTLED
        );
    }
}
