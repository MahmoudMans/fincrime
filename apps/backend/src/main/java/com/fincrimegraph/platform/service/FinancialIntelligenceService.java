package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.AccountRepository;
import com.fincrimegraph.platform.repository.AlertRepository;
import com.fincrimegraph.platform.repository.CustomerRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class FinancialIntelligenceService {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final AlertRepository alertRepository;
    private final TransactionRiskScoringService riskScoringService;

    public FinancialIntelligenceService(
            CustomerRepository customerRepository,
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            AlertRepository alertRepository,
            TransactionRiskScoringService riskScoringService
    ) {
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.alertRepository = alertRepository;
        this.riskScoringService = riskScoringService;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<CustomerSummary> customers(
            String query
    ) {
        List<CustomerEntity> customers =
                customerRepository.findAll();

        List<AccountEntity> accounts =
                accountRepository.findAll();

        List<TransactionEntity> transactions =
                transactionRepository.findAll();

        List<AlertEntity> alerts =
                alertRepository.findAll();

        String normalized =
                normalize(query);

        return customers
                .stream()
                .filter(
                        customer ->
                                normalized.isBlank()
                                        || contains(
                                                customer.getFullName(),
                                                normalized
                                        )
                                        || contains(
                                                customer.getExternalId(),
                                                normalized
                                        )
                                        || contains(
                                                customer.getCountryCode(),
                                                normalized
                                        )
                                        || contains(
                                                customer
                                                        .getRiskTier()
                                                        .name(),
                                                normalized
                                        )
                )
                .map(
                        customer ->
                                customerSummary(
                                        customer,
                                        accounts,
                                        transactions,
                                        alerts
                                )
                )
                .sorted(
                        Comparator
                                .comparingInt(
                                        CustomerSummary::openAlerts
                                )
                                .reversed()
                                .thenComparing(
                                        CustomerSummary::fullName
                                )
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public Customer360 customer360(
            UUID customerId
    ) {
        CustomerEntity customer =
                customerRepository
                        .findById(customerId)
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Customer not found: "
                                                + customerId
                                )
                        );

        List<AccountEntity> allAccounts =
                accountRepository.findAll();

        List<TransactionEntity> allTransactions =
                transactionRepository.findAll();

        List<AlertEntity> allAlerts =
                alertRepository.findAll();

        List<AccountEntity> customerAccounts =
                allAccounts
                        .stream()
                        .filter(
                                account ->
                                        account
                                                .getCustomer()
                                                .getId()
                                                .equals(customerId)
                        )
                        .toList();

        List<TransactionEntity> customerTransactions =
                allTransactions
                        .stream()
                        .filter(
                                transaction ->
                                        involvesCustomer(
                                                transaction,
                                                customerId
                                        )
                        )
                        .sorted(
                                Comparator
                                        .comparing(
                                                TransactionEntity
                                                        ::getOccurredAt
                                        )
                                        .reversed()
                        )
                        .toList();

        List<AlertEntity> customerAlerts =
                allAlerts
                        .stream()
                        .filter(
                                alert ->
                                        alert.getPrimaryAccount() != null
                                                && alert
                                                        .getPrimaryAccount()
                                                        .getCustomer()
                                                        .getId()
                                                        .equals(
                                                                customerId
                                                        )
                        )
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                AlertEntity
                                                        ::getRiskScore
                                        )
                                        .reversed()
                        )
                        .toList();

        CustomerSummary summary =
                customerSummary(
                        customer,
                        allAccounts,
                        allTransactions,
                        allAlerts
                );

        List<AccountSummary> accountViews =
                customerAccounts
                        .stream()
                        .map(
                                account ->
                                        accountSummary(
                                                account,
                                                allTransactions,
                                                allAlerts
                                        )
                        )
                        .sorted(
                                Comparator.comparing(
                                        AccountSummary
                                                ::accountNumber
                                )
                        )
                        .toList();

        return new Customer360(
                summary,
                accountViews,
                counterpartiesForCustomer(
                        customerId,
                        customerTransactions
                ),
                customerTransactions
                        .stream()
                        .limit(12)
                        .map(this::transactionView)
                        .toList(),
                customerAlerts
                        .stream()
                        .map(this::alertView)
                        .toList()
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<AccountSummary> accounts(
            String query
    ) {
        List<AccountEntity> accounts =
                accountRepository.findAll();

        List<TransactionEntity> transactions =
                transactionRepository.findAll();

        List<AlertEntity> alerts =
                alertRepository.findAll();

        String normalized =
                normalize(query);

        return accounts
                .stream()
                .filter(
                        account ->
                                normalized.isBlank()
                                        || contains(
                                                account.getAccountNumber(),
                                                normalized
                                        )
                                        || contains(
                                                account
                                                        .getCustomer()
                                                        .getFullName(),
                                                normalized
                                        )
                                        || contains(
                                                account.getCurrency(),
                                                normalized
                                        )
                                        || contains(
                                                account
                                                        .getStatus()
                                                        .name(),
                                                normalized
                                        )
                )
                .map(
                        account ->
                                accountSummary(
                                        account,
                                        transactions,
                                        alerts
                                )
                )
                .sorted(
                        Comparator
                                .comparingInt(
                                        AccountSummary::openAlerts
                                )
                                .reversed()
                                .thenComparing(
                                        AccountSummary
                                                ::accountNumber
                                )
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public Account360 account360(
            UUID accountId
    ) {
        AccountEntity account =
                accountRepository
                        .findById(accountId)
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Account not found: "
                                                + accountId
                                )
                        );

        List<TransactionEntity> transactions =
                transactionRepository
                        .findAll()
                        .stream()
                        .filter(
                                transaction ->
                                        involvesAccount(
                                                transaction,
                                                accountId
                                        )
                        )
                        .sorted(
                                Comparator
                                        .comparing(
                                                TransactionEntity
                                                        ::getOccurredAt
                                        )
                                        .reversed()
                        )
                        .toList();

        List<AlertEntity> allAlerts =
                alertRepository.findAll();

        List<AlertEntity> alerts =
                allAlerts
                        .stream()
                        .filter(
                                alert ->
                                        alert.getPrimaryAccount() != null
                                                && alert
                                                        .getPrimaryAccount()
                                                        .getId()
                                                        .equals(
                                                                accountId
                                                        )
                        )
                        .sorted(
                                Comparator
                                        .comparingInt(
                                                AlertEntity
                                                        ::getRiskScore
                                        )
                                        .reversed()
                        )
                        .toList();

        return new Account360(
                accountSummary(
                        account,
                        transactionRepository.findAll(),
                        allAlerts
                ),
                new CustomerIdentity(
                        account
                                .getCustomer()
                                .getId()
                                .toString(),
                        account
                                .getCustomer()
                                .getExternalId(),
                        account
                                .getCustomer()
                                .getFullName(),
                        account
                                .getCustomer()
                                .getCountryCode(),
                        account
                                .getCustomer()
                                .getRiskTier()
                                .name()
                ),
                counterpartiesForAccount(
                        accountId,
                        transactions
                ),
                transactions
                        .stream()
                        .limit(12)
                        .map(this::transactionView)
                        .toList(),
                alerts
                        .stream()
                        .map(this::alertView)
                        .toList()
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<TransactionExplorerItem> transactions(
            String query,
            String channel,
            String status,
            BigDecimal minAmount,
            BigDecimal maxAmount
    ) {
        String normalizedQuery =
                normalize(query);

        String normalizedChannel =
                normalize(channel);

        String normalizedStatus =
                normalize(status);

        return transactionRepository
                .findAll()
                .stream()
                .filter(
                        transaction ->
                                normalizedQuery.isBlank()
                                        || transactionMatchesQuery(
                                                transaction,
                                                normalizedQuery
                                        )
                )
                .filter(
                        transaction ->
                                normalizedChannel.isBlank()
                                        || transaction
                                                .getChannel()
                                                .name()
                                                .equalsIgnoreCase(
                                                        normalizedChannel
                                                )
                )
                .filter(
                        transaction ->
                                normalizedStatus.isBlank()
                                        || transaction
                                                .getStatus()
                                                .name()
                                                .equalsIgnoreCase(
                                                        normalizedStatus
                                                )
                )
                .filter(
                        transaction ->
                                minAmount == null
                                        || transaction
                                                .getAmount()
                                                .compareTo(
                                                        minAmount
                                                ) >= 0
                )
                .filter(
                        transaction ->
                                maxAmount == null
                                        || transaction
                                                .getAmount()
                                                .compareTo(
                                                        maxAmount
                                                ) <= 0
                )
                .sorted(
                        Comparator
                                .comparing(
                                        TransactionEntity
                                                ::getOccurredAt
                                )
                                .reversed()
                )
                .map(this::transactionView)
                .toList();
    }

    private CustomerSummary customerSummary(
            CustomerEntity customer,
            List<AccountEntity> accounts,
            List<TransactionEntity> transactions,
            List<AlertEntity> alerts
    ) {
        UUID customerId =
                customer.getId();

        long accountCount =
                accounts
                        .stream()
                        .filter(
                                account ->
                                        account
                                                .getCustomer()
                                                .getId()
                                                .equals(customerId)
                        )
                        .count();

        List<TransactionEntity> customerTransactions =
                transactions
                        .stream()
                        .filter(
                                transaction ->
                                        involvesCustomer(
                                                transaction,
                                                customerId
                                        )
                        )
                        .toList();

        BigDecimal totalInbound =
                customerTransactions
                        .stream()
                        .filter(
                                transaction ->
                                        transaction
                                                .getDestinationAccount()
                                                .getCustomer()
                                                .getId()
                                                .equals(customerId)
                        )
                        .map(
                                TransactionEntity::getAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal totalOutbound =
                customerTransactions
                        .stream()
                        .filter(
                                transaction ->
                                        transaction
                                                .getSourceAccount()
                                                .getCustomer()
                                                .getId()
                                                .equals(customerId)
                        )
                        .map(
                                TransactionEntity::getAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        int openAlerts =
                (int) alerts
                        .stream()
                        .filter(
                                alert ->
                                        alert.getStatus()
                                                != AlertEntity
                                                .AlertStatus
                                                .CLOSED
                        )
                        .filter(
                                alert ->
                                        alert.getPrimaryAccount() != null
                                                && alert
                                                        .getPrimaryAccount()
                                                        .getCustomer()
                                                        .getId()
                                                        .equals(
                                                                customerId
                                                        )
                        )
                        .count();

        return new CustomerSummary(
                customerId.toString(),
                customer.getExternalId(),
                customer.getFullName(),
                customer.getCountryCode(),
                customer.getRiskTier().name(),
                accountCount,
                customerTransactions.size(),
                openAlerts,
                totalInbound,
                totalOutbound,
                customer.getCreatedAt()
        );
    }

    private AccountSummary accountSummary(
            AccountEntity account,
            List<TransactionEntity> transactions,
            List<AlertEntity> alerts
    ) {
        UUID accountId =
                account.getId();

        List<TransactionEntity> accountTransactions =
                transactions
                        .stream()
                        .filter(
                                transaction ->
                                        involvesAccount(
                                                transaction,
                                                accountId
                                        )
                        )
                        .toList();

        BigDecimal totalInbound =
                accountTransactions
                        .stream()
                        .filter(
                                transaction ->
                                        transaction
                                                .getDestinationAccount()
                                                .getId()
                                                .equals(accountId)
                        )
                        .map(
                                TransactionEntity::getAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal totalOutbound =
                accountTransactions
                        .stream()
                        .filter(
                                transaction ->
                                        transaction
                                                .getSourceAccount()
                                                .getId()
                                                .equals(accountId)
                        )
                        .map(
                                TransactionEntity::getAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        int openAlerts =
                (int) alerts
                        .stream()
                        .filter(
                                alert ->
                                        alert.getStatus()
                                                != AlertEntity
                                                .AlertStatus
                                                .CLOSED
                        )
                        .filter(
                                alert ->
                                        alert.getPrimaryAccount() != null
                                                && alert
                                                        .getPrimaryAccount()
                                                        .getId()
                                                        .equals(
                                                                accountId
                                                        )
                        )
                        .count();

        return new AccountSummary(
                accountId.toString(),
                account.getAccountNumber(),
                account.getAccountType().name(),
                account.getCurrency(),
                account.getBalance(),
                account.getStatus().name(),
                account
                        .getCustomer()
                        .getId()
                        .toString(),
                account
                        .getCustomer()
                        .getFullName(),
                account
                        .getCustomer()
                        .getRiskTier()
                        .name(),
                accountTransactions.size(),
                openAlerts,
                totalInbound,
                totalOutbound,
                account.getCreatedAt()
        );
    }

    private List<CounterpartyView> counterpartiesForCustomer(
            UUID customerId,
            List<TransactionEntity> transactions
    ) {
        Map<UUID, CounterpartyAccumulator> counterparties =
                new HashMap<>();

        for (TransactionEntity transaction : transactions) {
            CustomerEntity counterparty;

            if (transaction
                    .getSourceAccount()
                    .getCustomer()
                    .getId()
                    .equals(customerId)) {

                counterparty =
                        transaction
                                .getDestinationAccount()
                                .getCustomer();
            } else {
                counterparty =
                        transaction
                                .getSourceAccount()
                                .getCustomer();
            }

            CounterpartyAccumulator accumulator =
                    counterparties.computeIfAbsent(
                            counterparty.getId(),
                            ignored ->
                                    new CounterpartyAccumulator(
                                            counterparty
                                    )
                    );

            accumulator.add(
                    transaction.getAmount()
            );
        }

        return counterparties
                .values()
                .stream()
                .sorted(
                        Comparator
                                .comparing(
                                        CounterpartyAccumulator
                                                ::volume
                                )
                                .reversed()
                )
                .map(
                        accumulator ->
                                new CounterpartyView(
                                        accumulator
                                                .customer()
                                                .getId()
                                                .toString(),
                                        accumulator
                                                .customer()
                                                .getFullName(),
                                        accumulator
                                                .customer()
                                                .getCountryCode(),
                                        accumulator
                                                .customer()
                                                .getRiskTier()
                                                .name(),
                                        accumulator
                                                .transactionCount(),
                                        accumulator.volume()
                                )
                )
                .toList();
    }

    private List<CounterpartyView> counterpartiesForAccount(
            UUID accountId,
            List<TransactionEntity> transactions
    ) {
        Map<UUID, CounterpartyAccumulator> counterparties =
                new HashMap<>();

        for (TransactionEntity transaction : transactions) {
            AccountEntity counterpartyAccount;

            if (transaction
                    .getSourceAccount()
                    .getId()
                    .equals(accountId)) {

                counterpartyAccount =
                        transaction
                                .getDestinationAccount();
            } else {
                counterpartyAccount =
                        transaction
                                .getSourceAccount();
            }

            CustomerEntity counterparty =
                    counterpartyAccount.getCustomer();

            CounterpartyAccumulator accumulator =
                    counterparties.computeIfAbsent(
                            counterparty.getId(),
                            ignored ->
                                    new CounterpartyAccumulator(
                                            counterparty
                                    )
                    );

            accumulator.add(
                    transaction.getAmount()
            );
        }

        return counterparties
                .values()
                .stream()
                .sorted(
                        Comparator
                                .comparing(
                                        CounterpartyAccumulator
                                                ::volume
                                )
                                .reversed()
                )
                .map(
                        accumulator ->
                                new CounterpartyView(
                                        accumulator
                                                .customer()
                                                .getId()
                                                .toString(),
                                        accumulator
                                                .customer()
                                                .getFullName(),
                                        accumulator
                                                .customer()
                                                .getCountryCode(),
                                        accumulator
                                                .customer()
                                                .getRiskTier()
                                                .name(),
                                        accumulator
                                                .transactionCount(),
                                        accumulator.volume()
                                )
                )
                .toList();
    }

    private TransactionExplorerItem transactionView(
            TransactionEntity transaction
    ) {
        TransactionRiskScoringService.RiskAssessment risk =
                riskScoringService.assess(
                        transaction
                );

        return new TransactionExplorerItem(
                transaction.getId().toString(),
                transaction.getReference(),
                transaction
                        .getSourceAccount()
                        .getId()
                        .toString(),
                transaction
                        .getSourceAccount()
                        .getAccountNumber(),
                transaction
                        .getSourceAccount()
                        .getCustomer()
                        .getFullName(),
                transaction
                        .getDestinationAccount()
                        .getId()
                        .toString(),
                transaction
                        .getDestinationAccount()
                        .getAccountNumber(),
                transaction
                        .getDestinationAccount()
                        .getCustomer()
                        .getFullName(),
                transaction.getAmount(),
                transaction.getCurrency(),
                transaction.getOccurredAt(),
                transaction.getChannel().name(),
                transaction.getDestinationCountry(),
                transaction.getStatus().name(),
                risk.score(),
                risk.reasons()
        );
    }

    private AlertSnapshot alertView(
            AlertEntity alert
    ) {
        return new AlertSnapshot(
                alert.getId().toString(),
                alert.getAlertCode(),
                alert.getAlertType().name(),
                alert.getSeverity().name(),
                alert.getRiskScore(),
                alert.getStatus().name(),
                alert.getTitle(),
                alert.getCreatedAt()
        );
    }

    private boolean involvesCustomer(
            TransactionEntity transaction,
            UUID customerId
    ) {
        return transaction
                .getSourceAccount()
                .getCustomer()
                .getId()
                .equals(customerId)
                || transaction
                .getDestinationAccount()
                .getCustomer()
                .getId()
                .equals(customerId);
    }

    private boolean involvesAccount(
            TransactionEntity transaction,
            UUID accountId
    ) {
        return transaction
                .getSourceAccount()
                .getId()
                .equals(accountId)
                || transaction
                .getDestinationAccount()
                .getId()
                .equals(accountId);
    }

    private boolean transactionMatchesQuery(
            TransactionEntity transaction,
            String query
    ) {
        List<String> values =
                List.of(
                        transaction.getReference(),
                        transaction
                                .getSourceAccount()
                                .getAccountNumber(),
                        transaction
                                .getSourceAccount()
                                .getCustomer()
                                .getFullName(),
                        transaction
                                .getDestinationAccount()
                                .getAccountNumber(),
                        transaction
                                .getDestinationAccount()
                                .getCustomer()
                                .getFullName(),
                        transaction
                                .getDestinationCountry(),
                        transaction
                                .getChannel()
                                .name(),
                        transaction
                                .getStatus()
                                .name()
                );

        return values
                .stream()
                .anyMatch(
                        value ->
                                contains(
                                        value,
                                        query
                                )
                );
    }

    private boolean contains(
            String value,
            String normalizedQuery
    ) {
        return value != null
                && value
                .toLowerCase(Locale.ROOT)
                .contains(normalizedQuery);
    }

    private String normalize(
            String value
    ) {
        if (value == null) {
            return "";
        }

        return value
                .trim()
                .toLowerCase(Locale.ROOT);
    }

    private static final class CounterpartyAccumulator {

        private final CustomerEntity customer;
        private int transactionCount;
        private BigDecimal volume;

        private CounterpartyAccumulator(
                CustomerEntity customer
        ) {
            this.customer = customer;
            this.transactionCount = 0;
            this.volume = BigDecimal.ZERO;
        }

        private void add(
                BigDecimal amount
        ) {
            transactionCount++;
            volume = volume.add(amount);
        }

        private CustomerEntity customer() {
            return customer;
        }

        private int transactionCount() {
            return transactionCount;
        }

        private BigDecimal volume() {
            return volume;
        }
    }

    public record CustomerSummary(
            String id,
            String externalId,
            String fullName,
            String countryCode,
            String riskTier,
            long accountCount,
            int transactionCount,
            int openAlerts,
            BigDecimal totalInbound,
            BigDecimal totalOutbound,
            Instant createdAt
    ) {
    }

    public record CustomerIdentity(
            String id,
            String externalId,
            String fullName,
            String countryCode,
            String riskTier
    ) {
    }

    public record AccountSummary(
            String id,
            String accountNumber,
            String accountType,
            String currency,
            BigDecimal balance,
            String status,
            String customerId,
            String customerName,
            String customerRiskTier,
            int transactionCount,
            int openAlerts,
            BigDecimal totalInbound,
            BigDecimal totalOutbound,
            Instant createdAt
    ) {
    }

    public record CounterpartyView(
            String customerId,
            String fullName,
            String countryCode,
            String riskTier,
            int transactionCount,
            BigDecimal volume
    ) {
    }

    public record AlertSnapshot(
            String id,
            String code,
            String type,
            String severity,
            int riskScore,
            String status,
            String title,
            Instant createdAt
    ) {
    }

    public record TransactionExplorerItem(
            String id,
            String reference,
            String sourceAccountId,
            String sourceAccount,
            String sourceCustomer,
            String destinationAccountId,
            String destinationAccount,
            String destinationCustomer,
            BigDecimal amount,
            String currency,
            Instant occurredAt,
            String channel,
            String destinationCountry,
            String status,
            int riskScore,
            List<String> riskReasons
    ) {
    }

    public record Customer360(
            CustomerSummary summary,
            List<AccountSummary> accounts,
            List<CounterpartyView> counterparties,
            List<TransactionExplorerItem> recentTransactions,
            List<AlertSnapshot> alerts
    ) {
    }

    public record Account360(
            AccountSummary summary,
            CustomerIdentity owner,
            List<CounterpartyView> counterparties,
            List<TransactionExplorerItem> recentTransactions,
            List<AlertSnapshot> alerts
    ) {
    }
}
