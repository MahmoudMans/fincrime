package com.fincrimegraph.platform.service;

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
import java.util.List;

@Service
public class DashboardService {

    private final CustomerRepository customerRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;
    private final AlertRepository alertRepository;

    public DashboardService(
            CustomerRepository customerRepository,
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            AlertRepository alertRepository
    ) {
        this.customerRepository = customerRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
        this.alertRepository = alertRepository;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public DashboardOverview getOverview() {
        DashboardSummary summary = new DashboardSummary(
                customerRepository.count(),
                accountRepository.count(),
                transactionRepository.count(),
                transactionRepository.totalTransactionVolume(),
                alertRepository.countByStatusNot(
                        AlertEntity.AlertStatus.CLOSED
                ),
                customerRepository.countByRiskTier(
                        CustomerEntity.RiskTier.HIGH
                )
        );

        List<AlertView> alerts =
                alertRepository
                        .findTop8ByOrderByRiskScoreDescCreatedAtDesc()
                        .stream()
                        .map(this::toAlertView)
                        .toList();

        List<TransactionView> transactions =
                transactionRepository
                        .findTop10ByOrderByOccurredAtDesc()
                        .stream()
                        .map(this::toTransactionView)
                        .toList();

        return new DashboardOverview(
                summary,
                alerts,
                transactions
        );
    }

    private AlertView toAlertView(AlertEntity alert) {
        return new AlertView(
                alert.getId().toString(),
                alert.getAlertCode(),
                alert.getAlertType().name(),
                alert.getSeverity().name(),
                alert.getRiskScore(),
                alert.getStatus().name(),
                alert.getTitle(),
                alert.getDescription(),
                alert.getPrimaryAccount() == null
                        ? null
                        : alert.getPrimaryAccount().getAccountNumber(),
                alert.getTransaction() == null
                        ? null
                        : alert.getTransaction().getReference(),
                alert.getCreatedAt()
        );
    }

    private TransactionView toTransactionView(
            TransactionEntity transaction
    ) {
        return new TransactionView(
                transaction.getId().toString(),
                transaction.getReference(),
                transaction.getSourceAccount().getAccountNumber(),
                transaction.getSourceAccount()
                        .getCustomer()
                        .getFullName(),
                transaction.getDestinationAccount().getAccountNumber(),
                transaction.getDestinationAccount()
                        .getCustomer()
                        .getFullName(),
                transaction.getAmount(),
                transaction.getCurrency(),
                transaction.getOccurredAt(),
                transaction.getChannel().name(),
                transaction.getDestinationCountry(),
                transaction.getStatus().name()
        );
    }

    public record DashboardOverview(
            DashboardSummary summary,
            List<AlertView> alerts,
            List<TransactionView> recentTransactions
    ) {
    }

    public record DashboardSummary(
            long customers,
            long accounts,
            long transactions,
            BigDecimal transactionVolume,
            long openAlerts,
            long highRiskCustomers
    ) {
    }

    public record AlertView(
            String id,
            String code,
            String type,
            String severity,
            int riskScore,
            String status,
            String title,
            String description,
            String accountNumber,
            String transactionReference,
            Instant createdAt
    ) {
    }

    public record TransactionView(
            String id,
            String reference,
            String sourceAccount,
            String sourceCustomer,
            String destinationAccount,
            String destinationCustomer,
            BigDecimal amount,
            String currency,
            Instant occurredAt,
            String channel,
            String destinationCountry,
            String status
    ) {
    }
}
