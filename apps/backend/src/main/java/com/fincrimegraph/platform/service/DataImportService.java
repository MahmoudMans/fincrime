package com.fincrimegraph.platform.service;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.DataImportJobEntity;
import com.fincrimegraph.platform.domain.DataImportRowIssueEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.AccountRepository;
import com.fincrimegraph.platform.repository.CustomerRepository;
import com.fincrimegraph.platform.repository.DataImportJobRepository;
import com.fincrimegraph.platform.repository.DataImportRowIssueRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class DataImportService {

    private static final long MAX_FILE_BYTES =
            5L * 1024L * 1024L;

    private static final int MAX_ROWS =
            5_000;

    private static final List<String>
            CUSTOMER_COLUMNS =
            List.of(
                    "external_id",
                    "full_name",
                    "country_code",
                    "risk_tier",
                    "created_at"
            );

    private static final List<String>
            ACCOUNT_COLUMNS =
            List.of(
                    "account_number",
                    "account_type",
                    "currency",
                    "balance",
                    "status",
                    "customer_external_id",
                    "created_at"
            );

    private static final List<String>
            TRANSACTION_COLUMNS =
            List.of(
                    "reference",
                    "source_account_number",
                    "destination_account_number",
                    "amount",
                    "currency",
                    "occurred_at",
                    "channel",
                    "destination_country",
                    "status"
            );

    private final DataImportFileParser parser;
    private final ObjectMapper objectMapper;

    private final DataImportJobRepository
            jobRepository;

    private final DataImportRowIssueRepository
            issueRepository;

    private final CustomerRepository
            customerRepository;

    private final AccountRepository
            accountRepository;

    private final TransactionRepository
            transactionRepository;

    private final GraphService graphService;

    private final TransactionTemplate
            transactionTemplate;

    public DataImportService(
            DataImportFileParser parser,
            ObjectMapper objectMapper,
            DataImportJobRepository jobRepository,
            DataImportRowIssueRepository issueRepository,
            CustomerRepository customerRepository,
            AccountRepository accountRepository,
            TransactionRepository transactionRepository,
            GraphService graphService,
            @Qualifier("transactionManager")
            PlatformTransactionManager
                    transactionManager
    ) {
        this.parser = parser;
        this.objectMapper = objectMapper;
        this.jobRepository = jobRepository;
        this.issueRepository = issueRepository;
        this.customerRepository =
                customerRepository;
        this.accountRepository =
                accountRepository;
        this.transactionRepository =
                transactionRepository;
        this.graphService = graphService;

        this.transactionTemplate =
                new TransactionTemplate(
                        transactionManager
                );
    }

    public List<SchemaView> schemas() {
        return List.of(
                new SchemaView(
                        "CUSTOMERS",
                        CUSTOMER_COLUMNS,
                        "external_id",
                        "None",
                        Map.of(
                                "risk_tier",
                                enumNames(
                                        CustomerEntity
                                                .RiskTier
                                                .values()
                                )
                        )
                ),
                new SchemaView(
                        "ACCOUNTS",
                        ACCOUNT_COLUMNS,
                        "account_number",
                        "customer_external_id "
                                + "must reference an existing customer.",
                        Map.of(
                                "account_type",
                                enumNames(
                                        AccountEntity
                                                .AccountType
                                                .values()
                                ),
                                "status",
                                enumNames(
                                        AccountEntity
                                                .AccountStatus
                                                .values()
                                )
                        )
                ),
                new SchemaView(
                        "TRANSACTIONS",
                        TRANSACTION_COLUMNS,
                        "reference",
                        "source_account_number and "
                                + "destination_account_number "
                                + "must reference existing accounts.",
                        Map.of(
                                "channel",
                                enumNames(
                                        TransactionEntity
                                                .TransactionChannel
                                                .values()
                                ),
                                "status",
                                enumNames(
                                        TransactionEntity
                                                .TransactionStatus
                                                .values()
                                )
                        )
                )
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public ImportJobView preview(
            MultipartFile file,
            String requestedDatasetType,
            String username
    ) {
        if (
                file == null
                        || file.isEmpty()
        ) {
            throw badRequest(
                    "Select a non-empty CSV or JSON file."
            );
        }

        if (file.getSize() > MAX_FILE_BYTES) {
            throw badRequest(
                    "Import files are limited to 5 MB."
            );
        }

        byte[] content;

        try {
            content = file.getBytes();
        } catch (Exception exception) {
            throw badRequest(
                    "The uploaded file could not be read."
            );
        }

        String fileName =
                safeFileName(
                        file.getOriginalFilename()
                );

        DataImportFileParser.ParsedInput
                parsed =
                parser.parse(
                        fileName,
                        content
                );

        if (
                parsed.rows().size()
                        > MAX_ROWS
        ) {
            throw badRequest(
                    "Import files are limited to "
                            + MAX_ROWS
                            + " data rows."
            );
        }

        DataImportJobEntity.DatasetType
                datasetType =
                resolveDatasetType(
                        requestedDatasetType,
                        parsed.headers()
                );

        ensureRequiredHeaders(
                datasetType,
                parsed.headers()
        );

        List<StagedRow> stagedRows =
                parsed.rows()
                        .stream()
                        .map(
                                item ->
                                        new StagedRow(
                                                item.rowNumber(),
                                                item.values()
                                        )
                        )
                        .toList();

        ValidationResult validation =
                validate(
                        datasetType,
                        stagedRows
                );

        DataImportJobEntity.ImportStatus
                status =
                importStatus(
                        validation
                );

        String payloadJson =
                serialize(
                        stagedRows
                );

        DataImportJobEntity job =
                new DataImportJobEntity(
                        UUID.randomUUID(),
                        datasetType,
                        fileName,
                        file.getContentType(),
                        file.getSize(),
                        sha256(content),
                        payloadJson,
                        username,
                        Instant.now()
                );

        job.applyValidation(
                status,
                validation.totalRows(),
                validation.validRows().size(),
                validation.duplicateRows(),
                validation.invalidRows(),
                payloadJson,
                Instant.now()
        );

        jobRepository.save(job);

        replaceIssues(
                job.getId(),
                validation.issues()
        );

        return toView(
                job,
                true
        );
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<ImportJobView> history() {
        return jobRepository
                .findTop50ByOrderByCreatedAtDesc()
                .stream()
                .map(
                        job ->
                                toView(
                                        job,
                                        false
                                )
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public ImportJobView detail(
            UUID jobId
    ) {
        return toView(
                requireJob(jobId),
                true
        );
    }

    public ImportJobView commit(
            UUID jobId
    ) {
        DataImportJobEntity existing =
                requireJob(jobId);

        if (
                existing.getStatus()
                        == DataImportJobEntity
                        .ImportStatus.IMPORTED
        ) {
            throw conflict(
                    "This import job has already been committed."
            );
        }

        if (
                existing.getStatus()
                        == DataImportJobEntity
                        .ImportStatus.FAILED
        ) {
            throw conflict(
                    "Failed import jobs cannot be committed."
            );
        }

        List<StagedRow> stagedRows =
                deserializeRows(
                        existing.getPayloadJson()
                );

        ValidationResult validation =
                validate(
                        existing.getDatasetType(),
                        stagedRows
                );

        if (
                validation.invalidRows() > 0
                        || validation.validRows()
                        .isEmpty()
        ) {
            transactionTemplate
                    .executeWithoutResult(
                            status -> {
                                DataImportJobEntity managed =
                                        requireJob(jobId);

                                managed.applyValidation(
                                        importStatus(
                                                validation
                                        ),
                                        validation.totalRows(),
                                        validation
                                                .validRows()
                                                .size(),
                                        validation
                                                .duplicateRows(),
                                        validation
                                                .invalidRows(),
                                        managed
                                                .getPayloadJson(),
                                        Instant.now()
                                );

                                jobRepository.save(
                                        managed
                                );

                                replaceIssues(
                                        jobId,
                                        validation.issues()
                                );
                            }
                    );

            return detail(jobId);
        }

        try {
            Objects.requireNonNull(
                    transactionTemplate.execute(
                            status -> {
                                DataImportJobEntity managed =
                                        requireJob(jobId);

                                managed.applyValidation(
                                        DataImportJobEntity
                                                .ImportStatus
                                                .READY,
                                        validation.totalRows(),
                                        validation
                                                .validRows()
                                                .size(),
                                        validation
                                                .duplicateRows(),
                                        validation
                                                .invalidRows(),
                                        managed
                                                .getPayloadJson(),
                                        Instant.now()
                                );

                                replaceIssues(
                                        jobId,
                                        validation.issues()
                                );

                                importRows(
                                        managed.getDatasetType(),
                                        validation.validRows()
                                );

                                managed.markImported(
                                        validation
                                                .validRows()
                                                .size(),
                                        Instant.now()
                                );

                                jobRepository.save(
                                        managed
                                );

                                return managed.getId();
                            }
                    )
            );

        } catch (RuntimeException exception) {

            DataImportJobEntity failed =
                    requireJob(jobId);

            failed.markFailed(
                    safeError(exception)
            );

            jobRepository.save(failed);

            throw new ResponseStatusException(
                    HttpStatus.INTERNAL_SERVER_ERROR,
                    "The relational import failed. "
                            + "No partial core-data import was committed."
            );
        }

        synchronizeImportedJob(
                jobId
        );

        return detail(jobId);
    }

    public GraphSyncView resynchronizeGraph() {
        List<CustomerEntity> customers =
                customerRepository.findAll();

        List<AccountEntity> accounts =
                accountRepository.findAll();

        List<TransactionEntity> transactions =
                transactionRepository.findAll();

        graphService.synchronize(
                customers,
                accounts,
                transactions
        );

        return new GraphSyncView(
                customers.size(),
                accounts.size(),
                transactions.size(),
                Instant.now()
        );
    }

    private void synchronizeImportedJob(
            UUID jobId
    ) {
        DataImportJobEntity job =
                requireJob(jobId);

        try {
            resynchronizeGraph();

            job.markGraphSynchronized();

        } catch (RuntimeException exception) {

            job.markGraphFailed(
                    safeError(exception)
            );
        }

        jobRepository.save(job);
    }

    private void importRows(
            DataImportJobEntity.DatasetType datasetType,
            List<StagedRow> rows
    ) {
        switch (datasetType) {

            case CUSTOMERS ->
                    importCustomers(rows);

            case ACCOUNTS ->
                    importAccounts(rows);

            case TRANSACTIONS ->
                    importTransactions(rows);
        }
    }

    private void importCustomers(
            List<StagedRow> rows
    ) {
        List<CustomerEntity> entities =
                rows.stream()
                        .map(
                                staged -> {
                                    Map<String, String> row =
                                            staged.values();

                                    return new CustomerEntity(
                                            UUID.randomUUID(),
                                            value(
                                                    row,
                                                    "external_id"
                                            ),
                                            value(
                                                    row,
                                                    "full_name"
                                            ),
                                            upper(
                                                    row,
                                                    "country_code"
                                            ),
                                            CustomerEntity
                                                    .RiskTier
                                                    .valueOf(
                                                            upper(
                                                                    row,
                                                                    "risk_tier"
                                                            )
                                                    ),
                                            Instant.parse(
                                                    value(
                                                            row,
                                                            "created_at"
                                                    )
                                            )
                                    );
                                }
                        )
                        .toList();

        customerRepository.saveAll(
                entities
        );

        customerRepository.flush();
    }

    private void importAccounts(
            List<StagedRow> rows
    ) {
        List<AccountEntity> entities =
                new ArrayList<>();

        for (StagedRow staged : rows) {
            Map<String, String> row =
                    staged.values();

            CustomerEntity customer =
                    customerRepository
                            .findByExternalId(
                                    value(
                                            row,
                                            "customer_external_id"
                                    )
                            )
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "Customer disappeared "
                                                            + "between validation "
                                                            + "and commit."
                                            )
                            );

            entities.add(
                    new AccountEntity(
                            UUID.randomUUID(),
                            value(
                                    row,
                                    "account_number"
                            ),
                            AccountEntity
                                    .AccountType
                                    .valueOf(
                                            upper(
                                                    row,
                                                    "account_type"
                                            )
                                    ),
                            upper(
                                    row,
                                    "currency"
                            ),
                            new BigDecimal(
                                    value(
                                            row,
                                            "balance"
                                    )
                            ),
                            AccountEntity
                                    .AccountStatus
                                    .valueOf(
                                            upper(
                                                    row,
                                                    "status"
                                            )
                                    ),
                            customer,
                            Instant.parse(
                                    value(
                                            row,
                                            "created_at"
                                    )
                            )
                    )
            );
        }

        accountRepository.saveAll(
                entities
        );

        accountRepository.flush();
    }

    private void importTransactions(
            List<StagedRow> rows
    ) {
        List<TransactionEntity> entities =
                new ArrayList<>();

        for (StagedRow staged : rows) {
            Map<String, String> row =
                    staged.values();

            AccountEntity source =
                    accountRepository
                            .findByAccountNumber(
                                    value(
                                            row,
                                            "source_account_number"
                                    )
                            )
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "Source account disappeared "
                                                            + "between validation "
                                                            + "and commit."
                                            )
                            );

            AccountEntity destination =
                    accountRepository
                            .findByAccountNumber(
                                    value(
                                            row,
                                            "destination_account_number"
                                    )
                            )
                            .orElseThrow(
                                    () ->
                                            new IllegalStateException(
                                                    "Destination account disappeared "
                                                            + "between validation "
                                                            + "and commit."
                                            )
                            );

            entities.add(
                    new TransactionEntity(
                            UUID.randomUUID(),
                            value(
                                    row,
                                    "reference"
                            ),
                            source,
                            destination,
                            new BigDecimal(
                                    value(
                                            row,
                                            "amount"
                                    )
                            ),
                            upper(
                                    row,
                                    "currency"
                            ),
                            Instant.parse(
                                    value(
                                            row,
                                            "occurred_at"
                                    )
                            ),
                            TransactionEntity
                                    .TransactionChannel
                                    .valueOf(
                                            upper(
                                                    row,
                                                    "channel"
                                            )
                                    ),
                            upper(
                                    row,
                                    "destination_country"
                            ),
                            TransactionEntity
                                    .TransactionStatus
                                    .valueOf(
                                            upper(
                                                    row,
                                                    "status"
                                            )
                                    )
                    )
            );
        }

        transactionRepository.saveAll(
                entities
        );

        transactionRepository.flush();
    }

    private ValidationResult validate(
            DataImportJobEntity.DatasetType datasetType,
            List<StagedRow> rows
    ) {
        Set<String> existingCustomers =
                new HashSet<>();

        for (
                CustomerEntity customer
                        : customerRepository.findAll()
        ) {
            existingCustomers.add(
                    customer.getExternalId()
            );
        }

        Set<String> existingAccounts =
                new HashSet<>();

        for (
                AccountEntity account
                        : accountRepository.findAll()
        ) {
            existingAccounts.add(
                    account.getAccountNumber()
            );
        }

        Set<String> existingTransactions =
                new HashSet<>();

        for (
                TransactionEntity transaction
                        : transactionRepository.findAll()
        ) {
            existingTransactions.add(
                    transaction.getReference()
            );
        }

        Set<String> seen =
                new HashSet<>();

        List<StagedRow> validRows =
                new ArrayList<>();

        List<ValidationIssue> issues =
                new ArrayList<>();

        int duplicateRows = 0;
        int invalidRows = 0;

        for (StagedRow staged : rows) {

            Map<String, String> row =
                    staged.values();

            List<ValidationIssue>
                    rowIssues =
                    validateFields(
                            datasetType,
                            staged,
                            existingCustomers,
                            existingAccounts
                    );

            String naturalKey =
                    naturalKey(
                            datasetType,
                            row
                    );

            boolean duplicate =
                    false;

            if (rowIssues.isEmpty()) {

                if (!seen.add(naturalKey)) {
                    duplicate = true;

                } else if (
                        existingKeySet(
                                datasetType,
                                existingCustomers,
                                existingAccounts,
                                existingTransactions
                        ).contains(
                                naturalKey
                        )
                ) {
                    duplicate = true;
                }
            }

            if (!rowIssues.isEmpty()) {
                invalidRows++;
                issues.addAll(rowIssues);

                continue;
            }

            if (duplicate) {
                duplicateRows++;

                issues.add(
                        new ValidationIssue(
                                staged.rowNumber(),
                                Classification.DUPLICATE,
                                naturalKeyField(
                                        datasetType
                                ),
                                "DUPLICATE_NATURAL_KEY",
                                "The natural key already exists "
                                        + "in this file or in the database.",
                                row
                        )
                );

                continue;
            }

            validRows.add(staged);
        }

        return new ValidationResult(
                rows.size(),
                List.copyOf(validRows),
                duplicateRows,
                invalidRows,
                List.copyOf(issues)
        );
    }

    private List<ValidationIssue> validateFields(
            DataImportJobEntity.DatasetType datasetType,
            StagedRow staged,
            Set<String> existingCustomers,
            Set<String> existingAccounts
    ) {
        List<ValidationIssue> issues =
                new ArrayList<>();

        Map<String, String> row =
                staged.values();

        switch (datasetType) {

            case CUSTOMERS -> {
                required(
                        staged,
                        "external_id",
                        32,
                        issues
                );

                required(
                        staged,
                        "full_name",
                        160,
                        issues
                );

                country(
                        staged,
                        "country_code",
                        issues
                );

                enumValue(
                        staged,
                        "risk_tier",
                        CustomerEntity
                                .RiskTier
                                .class,
                        issues
                );

                instant(
                        staged,
                        "created_at",
                        issues
                );
            }

            case ACCOUNTS -> {
                required(
                        staged,
                        "account_number",
                        64,
                        issues
                );

                enumValue(
                        staged,
                        "account_type",
                        AccountEntity
                                .AccountType
                                .class,
                        issues
                );

                currency(
                        staged,
                        "currency",
                        issues
                );

                decimal(
                        staged,
                        "balance",
                        false,
                        issues
                );

                enumValue(
                        staged,
                        "status",
                        AccountEntity
                                .AccountStatus
                                .class,
                        issues
                );

                String customerExternalId =
                        required(
                                staged,
                                "customer_external_id",
                                32,
                                issues
                        );

                if (
                        customerExternalId != null
                                && !existingCustomers
                                .contains(
                                        customerExternalId
                                )
                ) {
                    issue(
                            staged,
                            "customer_external_id",
                            "UNKNOWN_CUSTOMER",
                            "No customer with external_id "
                                    + customerExternalId
                                    + " exists.",
                            issues
                    );
                }

                instant(
                        staged,
                        "created_at",
                        issues
                );
            }

            case TRANSACTIONS -> {
                required(
                        staged,
                        "reference",
                        64,
                        issues
                );

                String source =
                        required(
                                staged,
                                "source_account_number",
                                64,
                                issues
                        );

                String destination =
                        required(
                                staged,
                                "destination_account_number",
                                64,
                                issues
                        );

                if (
                        source != null
                                && !existingAccounts
                                .contains(source)
                ) {
                    issue(
                            staged,
                            "source_account_number",
                            "UNKNOWN_SOURCE_ACCOUNT",
                            "Source account "
                                    + source
                                    + " does not exist.",
                            issues
                    );
                }

                if (
                        destination != null
                                && !existingAccounts
                                .contains(destination)
                ) {
                    issue(
                            staged,
                            "destination_account_number",
                            "UNKNOWN_DESTINATION_ACCOUNT",
                            "Destination account "
                                    + destination
                                    + " does not exist.",
                            issues
                    );
                }

                decimal(
                        staged,
                        "amount",
                        true,
                        issues
                );

                currency(
                        staged,
                        "currency",
                        issues
                );

                instant(
                        staged,
                        "occurred_at",
                        issues
                );

                enumValue(
                        staged,
                        "channel",
                        TransactionEntity
                                .TransactionChannel
                                .class,
                        issues
                );

                country(
                        staged,
                        "destination_country",
                        issues
                );

                enumValue(
                        staged,
                        "status",
                        TransactionEntity
                                .TransactionStatus
                                .class,
                        issues
                );
            }
        }

        return issues;
    }

    private String required(
            StagedRow row,
            String field,
            int maxLength,
            List<ValidationIssue> issues
    ) {
        String value =
                value(
                        row.values(),
                        field
                );

        if (value.isBlank()) {
            issue(
                    row,
                    field,
                    "REQUIRED",
                    field
                            + " is required.",
                    issues
            );

            return null;
        }

        if (value.length() > maxLength) {
            issue(
                    row,
                    field,
                    "MAX_LENGTH",
                    field
                            + " exceeds "
                            + maxLength
                            + " characters.",
                    issues
            );
        }

        return value;
    }

    private void country(
            StagedRow row,
            String field,
            List<ValidationIssue> issues
    ) {
        String value =
                required(
                        row,
                        field,
                        2,
                        issues
                );

        if (
                value != null
                        && !upper(
                        value
                ).matches("[A-Z]{2}")
        ) {
            issue(
                    row,
                    field,
                    "COUNTRY_CODE",
                    field
                            + " must be a two-letter country code.",
                    issues
            );
        }
    }

    private void currency(
            StagedRow row,
            String field,
            List<ValidationIssue> issues
    ) {
        String value =
                required(
                        row,
                        field,
                        3,
                        issues
                );

        if (
                value != null
                        && !upper(
                        value
                ).matches("[A-Z]{3}")
        ) {
            issue(
                    row,
                    field,
                    "CURRENCY_CODE",
                    field
                            + " must be a three-letter currency code.",
                    issues
            );
        }
    }

    private void decimal(
            StagedRow row,
            String field,
            boolean positiveOnly,
            List<ValidationIssue> issues
    ) {
        String value =
                required(
                        row,
                        field,
                        50,
                        issues
                );

        if (value == null) {
            return;
        }

        try {
            BigDecimal number =
                    new BigDecimal(value);

            if (
                    positiveOnly
                            && number.signum() <= 0
            ) {
                issue(
                        row,
                        field,
                        "POSITIVE_AMOUNT_REQUIRED",
                        field
                                + " must be greater than zero.",
                        issues
                );
            }

        } catch (NumberFormatException exception) {
            issue(
                    row,
                    field,
                    "DECIMAL",
                    field
                            + " must be a valid decimal number.",
                    issues
            );
        }
    }

    private void instant(
            StagedRow row,
            String field,
            List<ValidationIssue> issues
    ) {
        String value =
                required(
                        row,
                        field,
                        80,
                        issues
                );

        if (value == null) {
            return;
        }

        try {
            Instant.parse(value);

        } catch (Exception exception) {
            issue(
                    row,
                    field,
                    "ISO_INSTANT",
                    field
                            + " must use ISO-8601 UTC format, "
                            + "for example 2026-10-04T12:00:00Z.",
                    issues
            );
        }
    }

    private <E extends Enum<E>>
    void enumValue(
            StagedRow row,
            String field,
            Class<E> enumClass,
            List<ValidationIssue> issues
    ) {
        String value =
                required(
                        row,
                        field,
                        64,
                        issues
                );

        if (value == null) {
            return;
        }

        try {
            Enum.valueOf(
                    enumClass,
                    upper(value)
            );

        } catch (Exception exception) {

            issue(
                    row,
                    field,
                    "ENUM",
                    field
                            + " must be one of "
                            + enumNames(
                            enumClass
                                    .getEnumConstants()
                    )
                            + ".",
                    issues
            );
        }
    }

    private void issue(
            StagedRow row,
            String field,
            String code,
            String message,
            List<ValidationIssue> issues
    ) {
        issues.add(
                new ValidationIssue(
                        row.rowNumber(),
                        Classification.INVALID,
                        field,
                        code,
                        message,
                        row.values()
                )
        );
    }

    private DataImportJobEntity.DatasetType
    resolveDatasetType(
            String requested,
            List<String> headers
    ) {
        String value =
                requested == null
                        ? "AUTO"
                        : requested
                        .trim()
                        .toUpperCase(
                                Locale.ROOT
                        );

        if (!"AUTO".equals(value)) {
            try {
                return DataImportJobEntity
                        .DatasetType
                        .valueOf(value);

            } catch (Exception exception) {
                throw badRequest(
                        "Unsupported dataset type: "
                                + value
                );
            }
        }

        Set<String> actual =
                new HashSet<>(headers);

        List<DataImportJobEntity.DatasetType>
                matches =
                new ArrayList<>();

        if (
                actual.containsAll(
                        CUSTOMER_COLUMNS
                )
        ) {
            matches.add(
                    DataImportJobEntity
                            .DatasetType
                            .CUSTOMERS
            );
        }

        if (
                actual.containsAll(
                        ACCOUNT_COLUMNS
                )
        ) {
            matches.add(
                    DataImportJobEntity
                            .DatasetType
                            .ACCOUNTS
            );
        }

        if (
                actual.containsAll(
                        TRANSACTION_COLUMNS
                )
        ) {
            matches.add(
                    DataImportJobEntity
                            .DatasetType
                            .TRANSACTIONS
            );
        }

        if (matches.size() != 1) {
            throw badRequest(
                    "Dataset type could not be detected uniquely. "
                            + "Select Customers, Accounts, "
                            + "or Transactions explicitly."
            );
        }

        return matches.getFirst();
    }

    private void ensureRequiredHeaders(
            DataImportJobEntity.DatasetType type,
            List<String> headers
    ) {
        Set<String> actual =
                new HashSet<>(headers);

        List<String> required =
                requiredColumns(type);

        List<String> missing =
                required.stream()
                        .filter(
                                header ->
                                        !actual.contains(
                                                header
                                        )
                        )
                        .toList();

        if (!missing.isEmpty()) {
            throw badRequest(
                    "Missing required columns: "
                            + String.join(
                            ", ",
                            missing
                    )
            );
        }
    }

    private List<String> requiredColumns(
            DataImportJobEntity.DatasetType type
    ) {
        return switch (type) {
            case CUSTOMERS ->
                    CUSTOMER_COLUMNS;

            case ACCOUNTS ->
                    ACCOUNT_COLUMNS;

            case TRANSACTIONS ->
                    TRANSACTION_COLUMNS;
        };
    }

    private Set<String> existingKeySet(
            DataImportJobEntity.DatasetType type,
            Set<String> customers,
            Set<String> accounts,
            Set<String> transactions
    ) {
        return switch (type) {
            case CUSTOMERS ->
                    customers;

            case ACCOUNTS ->
                    accounts;

            case TRANSACTIONS ->
                    transactions;
        };
    }

    private String naturalKey(
            DataImportJobEntity.DatasetType type,
            Map<String, String> row
    ) {
        return switch (type) {
            case CUSTOMERS ->
                    value(
                            row,
                            "external_id"
                    );

            case ACCOUNTS ->
                    value(
                            row,
                            "account_number"
                    );

            case TRANSACTIONS ->
                    value(
                            row,
                            "reference"
                    );
        };
    }

    private String naturalKeyField(
            DataImportJobEntity.DatasetType type
    ) {
        return switch (type) {
            case CUSTOMERS ->
                    "external_id";

            case ACCOUNTS ->
                    "account_number";

            case TRANSACTIONS ->
                    "reference";
        };
    }

    private DataImportJobEntity.ImportStatus
    importStatus(
            ValidationResult result
    ) {
        if (result.invalidRows() > 0) {
            return DataImportJobEntity
                    .ImportStatus
                    .VALIDATED;
        }

        if (result.validRows().isEmpty()) {
            return DataImportJobEntity
                    .ImportStatus
                    .VALIDATED;
        }

        return DataImportJobEntity
                .ImportStatus
                .READY;
    }

    private void replaceIssues(
            UUID jobId,
            List<ValidationIssue> issues
    ) {
        issueRepository.deleteByJobId(
                jobId
        );

        if (issues.isEmpty()) {
            return;
        }

        List<DataImportRowIssueEntity>
                entities =
                issues.stream()
                        .map(
                                issue ->
                                        new DataImportRowIssueEntity(
                                                UUID.randomUUID(),
                                                jobId,
                                                issue.rowNumber(),
                                                issue
                                                        .classification()
                                                        .name(),
                                                issue.field(),
                                                issue.code(),
                                                issue.message(),
                                                serialize(
                                                        issue.row()
                                                ),
                                                Instant.now()
                                        )
                        )
                        .toList();

        issueRepository.saveAll(
                entities
        );
    }

    private ImportJobView toView(
            DataImportJobEntity job,
            boolean detailed
    ) {
        List<Map<String, String>>
                previewRows =
                List.of();

        List<IssueView> issues =
                List.of();

        if (detailed) {
            previewRows =
                    deserializeRows(
                            job.getPayloadJson()
                    )
                            .stream()
                            .limit(12)
                            .map(
                                    StagedRow::values
                            )
                            .toList();

            issues =
                    issueRepository
                            .findByJobIdOrderByRowNumberAsc(
                                    job.getId()
                            )
                            .stream()
                            .limit(100)
                            .map(
                                    issue ->
                                            new IssueView(
                                                    issue
                                                            .getRowNumber(),
                                                    issue
                                                            .getClassification(),
                                                    issue
                                                            .getFieldName(),
                                                    issue
                                                            .getIssueCode(),
                                                    issue
                                                            .getMessage()
                                            )
                            )
                            .toList();
        }

        return new ImportJobView(
                job.getId().toString(),
                job.getDatasetType().name(),
                job.getFileName(),
                job.getMediaType(),
                job.getFileSize(),
                job.getSha256(),
                job.getStatus().name(),
                job.getTotalRows(),
                job.getValidRows(),
                job.getDuplicateRows(),
                job.getInvalidRows(),
                job.getImportedRows(),
                job.getCreatedBy(),
                job.getCreatedAt(),
                job.getValidatedAt(),
                job.getImportedAt(),
                job.getGraphSyncStatus().name(),
                job.getGraphSyncError(),
                job.getFailureMessage(),
                previewRows,
                issues
        );
    }

    private DataImportJobEntity requireJob(
            UUID jobId
    ) {
        return jobRepository
                .findById(jobId)
                .orElseThrow(
                        () ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "Import job not found."
                                )
                );
    }

    private String serialize(
            Object value
    ) {
        try {
            return objectMapper
                    .writeValueAsString(
                            value
                    );

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Import staging serialization failed.",
                    exception
            );
        }
    }

    private List<StagedRow> deserializeRows(
            String value
    ) {
        try {
            return objectMapper.readValue(
                    value,
                    new TypeReference<
                            List<StagedRow>
                            >() {
                    }
            );

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "Import staging payload is invalid.",
                    exception
            );
        }
    }

    private String sha256(
            byte[] value
    ) {
        try {
            byte[] digest =
                    MessageDigest
                            .getInstance("SHA-256")
                            .digest(value);

            return java.util.HexFormat
                    .of()
                    .formatHex(digest);

        } catch (Exception exception) {
            throw new IllegalStateException(
                    "SHA-256 is unavailable.",
                    exception
            );
        }
    }

    private String safeFileName(
            String original
    ) {
        if (
                original == null
                        || original.isBlank()
        ) {
            return "upload";
        }

        try {
            String value =
                    Path.of(original)
                            .getFileName()
                            .toString();

            return value.length() <= 255
                    ? value
                    : value.substring(
                    value.length() - 255
            );

        } catch (Exception exception) {
            return "upload";
        }
    }

    private String safeError(
            Throwable throwable
    ) {
        String message =
                throwable.getMessage();

        if (
                message == null
                        || message.isBlank()
        ) {
            return throwable
                    .getClass()
                    .getSimpleName();
        }

        return message.length() <= 1000
                ? message
                : message.substring(
                0,
                1000
        );
    }

    private String value(
            Map<String, String> row,
            String field
    ) {
        String value =
                row.get(field);

        return value == null
                ? ""
                : value.trim();
    }

    private String upper(
            Map<String, String> row,
            String field
    ) {
        return upper(
                value(
                        row,
                        field
                )
        );
    }

    private String upper(
            String value
    ) {
        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private static List<String> enumNames(
            Enum<?>[] values
    ) {
        List<String> names =
                new ArrayList<>();

        for (Enum<?> value : values) {
            names.add(
                    value.name()
            );
        }

        return List.copyOf(
                names
        );
    }

    private ResponseStatusException badRequest(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                message
        );
    }

    private ResponseStatusException conflict(
            String message
    ) {
        return new ResponseStatusException(
                HttpStatus.CONFLICT,
                message
        );
    }

    public enum Classification {
        INVALID,
        DUPLICATE
    }

    public record StagedRow(
            int rowNumber,
            Map<String, String> values
    ) {
        public StagedRow {
            values =
                    Map.copyOf(
                            new LinkedHashMap<>(
                                    values
                            )
                    );
        }
    }

    private record ValidationIssue(
            int rowNumber,
            Classification classification,
            String field,
            String code,
            String message,
            Map<String, String> row
    ) {
    }

    private record ValidationResult(
            int totalRows,
            List<StagedRow> validRows,
            int duplicateRows,
            int invalidRows,
            List<ValidationIssue> issues
    ) {
    }

    public record SchemaView(
            String datasetType,
            List<String> requiredColumns,
            String naturalKey,
            String dependency,
            Map<String, List<String>>
                    allowedValues
    ) {
    }

    public record IssueView(
            int rowNumber,
            String classification,
            String field,
            String code,
            String message
    ) {
    }

    public record ImportJobView(
            String id,
            String datasetType,
            String fileName,
            String mediaType,
            long fileSize,
            String sha256,
            String status,
            int totalRows,
            int validRows,
            int duplicateRows,
            int invalidRows,
            int importedRows,
            String createdBy,
            Instant createdAt,
            Instant validatedAt,
            Instant importedAt,
            String graphSyncStatus,
            String graphSyncError,
            String failureMessage,
            List<Map<String, String>>
                    previewRows,
            List<IssueView> issues
    ) {
    }

    public record GraphSyncView(
            int customers,
            int accounts,
            int transactions,
            Instant synchronizedAt
    ) {
    }
}
