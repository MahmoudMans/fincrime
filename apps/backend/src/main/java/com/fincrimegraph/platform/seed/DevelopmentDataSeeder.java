package com.fincrimegraph.platform.seed;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.AccountRepository;
import com.fincrimegraph.platform.repository.AlertRepository;
import com.fincrimegraph.platform.repository.CustomerRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import com.fincrimegraph.platform.service.GraphService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class DevelopmentDataSeeder implements ApplicationRunner {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final AlertRepository alertRepository;
    private final GraphService graphService;

    public DevelopmentDataSeeder(
            CustomerRepository customerRepository,
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            AlertRepository alertRepository,
            GraphService graphService
    ) {
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.alertRepository = alertRepository;
        this.graphService = graphService;
    }

    @Override
    @Transactional(transactionManager = "transactionManager")
    public void run(ApplicationArguments args) {
        if (customerRepository.count() == 0) {
            seedRelationalData();
        }

        graphService.synchronize(
                customerRepository.findAll(),
                accountRepository.findAll(),
                transactionRepository.findAll()
        );
    }

    private void seedRelationalData() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MINUTES);

        CustomerEntity nadia = customer(
                "CUST-001",
                "Nadia Ben Salem",
                "TN",
                CustomerEntity.RiskTier.HIGH,
                now.minus(420, ChronoUnit.DAYS)
        );

        CustomerEntity omar = customer(
                "CUST-002",
                "Omar Haddad",
                "FR",
                CustomerEntity.RiskTier.MEDIUM,
                now.minus(390, ChronoUnit.DAYS)
        );

        CustomerEntity lina = customer(
                "CUST-003",
                "Lina Moreau",
                "FR",
                CustomerEntity.RiskTier.LOW,
                now.minus(355, ChronoUnit.DAYS)
        );

        CustomerEntity karim = customer(
                "CUST-004",
                "Karim Diallo",
                "SN",
                CustomerEntity.RiskTier.MEDIUM,
                now.minus(330, ChronoUnit.DAYS)
        );

        CustomerEntity sofia = customer(
                "CUST-005",
                "Sofia Rossi",
                "IT",
                CustomerEntity.RiskTier.LOW,
                now.minus(300, ChronoUnit.DAYS)
        );

        CustomerEntity daniel = customer(
                "CUST-006",
                "Daniel Mensah",
                "GH",
                CustomerEntity.RiskTier.HIGH,
                now.minus(280, ChronoUnit.DAYS)
        );

        CustomerEntity emma = customer(
                "CUST-007",
                "Emma Laurent",
                "FR",
                CustomerEntity.RiskTier.LOW,
                now.minus(260, ChronoUnit.DAYS)
        );

        CustomerEntity youssef = customer(
                "CUST-008",
                "Youssef Amari",
                "AE",
                CustomerEntity.RiskTier.HIGH,
                now.minus(220, ChronoUnit.DAYS)
        );

        customerRepository.saveAll(
                List.of(
                        nadia,
                        omar,
                        lina,
                        karim,
                        sofia,
                        daniel,
                        emma,
                        youssef
                )
        );

        AccountEntity a1 = account(
                "FCG-100001",
                AccountEntity.AccountType.CHECKING,
                "EUR",
                "48250.00",
                AccountEntity.AccountStatus.REVIEW,
                nadia,
                now.minus(400, ChronoUnit.DAYS)
        );

        AccountEntity a2 = account(
                "FCG-100002",
                AccountEntity.AccountType.BUSINESS,
                "EUR",
                "125500.00",
                AccountEntity.AccountStatus.ACTIVE,
                omar,
                now.minus(380, ChronoUnit.DAYS)
        );

        AccountEntity a3 = account(
                "FCG-100003",
                AccountEntity.AccountType.CHECKING,
                "EUR",
                "19750.00",
                AccountEntity.AccountStatus.ACTIVE,
                lina,
                now.minus(345, ChronoUnit.DAYS)
        );

        AccountEntity a4 = account(
                "FCG-100004",
                AccountEntity.AccountType.BUSINESS,
                "EUR",
                "88200.00",
                AccountEntity.AccountStatus.REVIEW,
                karim,
                now.minus(320, ChronoUnit.DAYS)
        );

        AccountEntity a5 = account(
                "FCG-100005",
                AccountEntity.AccountType.SAVINGS,
                "EUR",
                "34700.00",
                AccountEntity.AccountStatus.ACTIVE,
                sofia,
                now.minus(295, ChronoUnit.DAYS)
        );

        AccountEntity a6 = account(
                "FCG-100006",
                AccountEntity.AccountType.BUSINESS,
                "USD",
                "220300.00",
                AccountEntity.AccountStatus.REVIEW,
                daniel,
                now.minus(275, ChronoUnit.DAYS)
        );

        AccountEntity a7 = account(
                "FCG-100007",
                AccountEntity.AccountType.CHECKING,
                "EUR",
                "21800.00",
                AccountEntity.AccountStatus.ACTIVE,
                emma,
                now.minus(250, ChronoUnit.DAYS)
        );

        AccountEntity a8 = account(
                "FCG-100008",
                AccountEntity.AccountType.BUSINESS,
                "USD",
                "175900.00",
                AccountEntity.AccountStatus.REVIEW,
                youssef,
                now.minus(210, ChronoUnit.DAYS)
        );

        AccountEntity a9 = account(
                "FCG-100009",
                AccountEntity.AccountType.SAVINGS,
                "EUR",
                "15900.00",
                AccountEntity.AccountStatus.ACTIVE,
                nadia,
                now.minus(190, ChronoUnit.DAYS)
        );

        AccountEntity a10 = account(
                "FCG-100010",
                AccountEntity.AccountType.BUSINESS,
                "USD",
                "96400.00",
                AccountEntity.AccountStatus.ACTIVE,
                omar,
                now.minus(170, ChronoUnit.DAYS)
        );

        accountRepository.saveAll(
                List.of(
                        a1,
                        a2,
                        a3,
                        a4,
                        a5,
                        a6,
                        a7,
                        a8,
                        a9,
                        a10
                )
        );

        Instant activityBase = now.minus(6, ChronoUnit.HOURS);

        List<TransactionEntity> transactions = new ArrayList<>();

        TransactionEntity t1 = transaction(
                "TXN-260901",
                a1,
                a4,
                "9800.00",
                "EUR",
                activityBase.plus(12, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "SN",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t2 = transaction(
                "TXN-260902",
                a4,
                a6,
                "9650.00",
                "EUR",
                activityBase.plus(19, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "GH",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t3 = transaction(
                "TXN-260903",
                a6,
                a1,
                "9475.00",
                "EUR",
                activityBase.plus(27, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "TN",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t4 = transaction(
                "TXN-260904",
                a2,
                a9,
                "4800.00",
                "EUR",
                activityBase.plus(65, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.BANK_TRANSFER,
                "TN",
                TransactionEntity.TransactionStatus.SETTLED
        );

        TransactionEntity t5 = transaction(
                "TXN-260905",
                a2,
                a9,
                "4900.00",
                "EUR",
                activityBase.plus(74, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.BANK_TRANSFER,
                "TN",
                TransactionEntity.TransactionStatus.SETTLED
        );

        TransactionEntity t6 = transaction(
                "TXN-260906",
                a2,
                a9,
                "4700.00",
                "EUR",
                activityBase.plus(82, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.BANK_TRANSFER,
                "TN",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t7 = transaction(
                "TXN-260907",
                a6,
                a8,
                "28750.00",
                "USD",
                activityBase.plus(110, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "AE",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t8 = transaction(
                "TXN-260908",
                a3,
                a5,
                "820.00",
                "EUR",
                activityBase.plus(130, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.BANK_TRANSFER,
                "IT",
                TransactionEntity.TransactionStatus.SETTLED
        );

        TransactionEntity t9 = transaction(
                "TXN-260909",
                a5,
                a7,
                "1250.00",
                "EUR",
                activityBase.plus(155, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.BANK_TRANSFER,
                "FR",
                TransactionEntity.TransactionStatus.SETTLED
        );

        TransactionEntity t10 = transaction(
                "TXN-260910",
                a8,
                a10,
                "18300.00",
                "USD",
                activityBase.plus(178, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "FR",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t11 = transaction(
                "TXN-260911",
                a7,
                a3,
                "540.00",
                "EUR",
                activityBase.plus(205, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.CARD,
                "FR",
                TransactionEntity.TransactionStatus.SETTLED
        );

        TransactionEntity t12 = transaction(
                "TXN-260912",
                a9,
                a6,
                "7350.00",
                "EUR",
                activityBase.plus(230, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "GH",
                TransactionEntity.TransactionStatus.REVIEW
        );

        TransactionEntity t13 = transaction(
                "TXN-260913",
                a10,
                a2,
                "3100.00",
                "USD",
                activityBase.plus(255, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.BANK_TRANSFER,
                "FR",
                TransactionEntity.TransactionStatus.SETTLED
        );

        TransactionEntity t14 = transaction(
                "TXN-260914",
                a1,
                a8,
                "12600.00",
                "EUR",
                activityBase.plus(285, ChronoUnit.MINUTES),
                TransactionEntity.TransactionChannel.WIRE,
                "AE",
                TransactionEntity.TransactionStatus.REVIEW
        );

        transactions.addAll(
                List.of(
                        t1,
                        t2,
                        t3,
                        t4,
                        t5,
                        t6,
                        t7,
                        t8,
                        t9,
                        t10,
                        t11,
                        t12,
                        t13,
                        t14
                )
        );

        transactionRepository.saveAll(transactions);

        List<AlertEntity> alerts = List.of(

                alert(
                        "ALT-001",
                        AlertEntity.AlertType.CIRCULAR_FLOW,
                        AlertEntity.AlertSeverity.CRITICAL,
                        96,
                        AlertEntity.AlertStatus.OPEN,
                        "Circular transfer chain detected",
                        "Funds moved through three accounts and returned to the originating relationship within a short time window.",
                        a1,
                        t3,
                        activityBase.plus(29, ChronoUnit.MINUTES)
                ),

                alert(
                        "ALT-002",
                        AlertEntity.AlertType.STRUCTURING,
                        AlertEntity.AlertSeverity.HIGH,
                        88,
                        AlertEntity.AlertStatus.IN_REVIEW,
                        "Repeated split transfers detected",
                        "Multiple similarly sized transfers were sent to the same beneficiary within a compressed time interval.",
                        a2,
                        t6,
                        activityBase.plus(85, ChronoUnit.MINUTES)
                ),

                alert(
                        "ALT-003",
                        AlertEntity.AlertType.LARGE_CROSS_BORDER,
                        AlertEntity.AlertSeverity.HIGH,
                        84,
                        AlertEntity.AlertStatus.OPEN,
                        "Large cross-border wire",
                        "A high-value wire connected two customer relationships already carrying elevated internal risk classifications.",
                        a6,
                        t7,
                        activityBase.plus(113, ChronoUnit.MINUTES)
                ),

                alert(
                        "ALT-004",
                        AlertEntity.AlertType.HIGH_RISK_COUNTERPARTY,
                        AlertEntity.AlertSeverity.HIGH,
                        79,
                        AlertEntity.AlertStatus.OPEN,
                        "Elevated counterparty exposure",
                        "A material payment was made between customer relationships with elevated monitoring classifications.",
                        a1,
                        t14,
                        activityBase.plus(288, ChronoUnit.MINUTES)
                ),

                alert(
                        "ALT-005",
                        AlertEntity.AlertType.VELOCITY_ANOMALY,
                        AlertEntity.AlertSeverity.MEDIUM,
                        67,
                        AlertEntity.AlertStatus.OPEN,
                        "Transaction velocity anomaly",
                        "The account participated in several transfers over a substantially shorter period than its synthetic baseline.",
                        a9,
                        t12,
                        activityBase.plus(233, ChronoUnit.MINUTES)
                )
        );

        alertRepository.saveAll(alerts);
    }

    private CustomerEntity customer(
            String externalId,
            String name,
            String countryCode,
            CustomerEntity.RiskTier riskTier,
            Instant createdAt
    ) {
        return new CustomerEntity(
                deterministicId("customer:" + externalId),
                externalId,
                name,
                countryCode,
                riskTier,
                createdAt
        );
    }

    private AccountEntity account(
            String accountNumber,
            AccountEntity.AccountType type,
            String currency,
            String balance,
            AccountEntity.AccountStatus status,
            CustomerEntity customer,
            Instant createdAt
    ) {
        return new AccountEntity(
                deterministicId("account:" + accountNumber),
                accountNumber,
                type,
                currency,
                new BigDecimal(balance),
                status,
                customer,
                createdAt
        );
    }

    private TransactionEntity transaction(
            String reference,
            AccountEntity source,
            AccountEntity destination,
            String amount,
            String currency,
            Instant occurredAt,
            TransactionEntity.TransactionChannel channel,
            String destinationCountry,
            TransactionEntity.TransactionStatus status
    ) {
        return new TransactionEntity(
                deterministicId("transaction:" + reference),
                reference,
                source,
                destination,
                new BigDecimal(amount),
                currency,
                occurredAt,
                channel,
                destinationCountry,
                status
        );
    }

    private AlertEntity alert(
            String code,
            AlertEntity.AlertType type,
            AlertEntity.AlertSeverity severity,
            int riskScore,
            AlertEntity.AlertStatus status,
            String title,
            String description,
            AccountEntity account,
            TransactionEntity transaction,
            Instant createdAt
    ) {
        return new AlertEntity(
                deterministicId("alert:" + code),
                code,
                type,
                severity,
                riskScore,
                status,
                title,
                description,
                account,
                transaction,
                createdAt
        );
    }

    private UUID deterministicId(String value) {
        return UUID.nameUUIDFromBytes(
                value.getBytes(StandardCharsets.UTF_8)
        );
    }
}
