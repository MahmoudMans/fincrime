package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.ScreeningHitEntity;
import com.fincrimegraph.platform.domain.ScreeningRunEntity;
import com.fincrimegraph.platform.domain.WatchlistEntryEntity;
import com.fincrimegraph.platform.repository.CustomerRepository;
import com.fincrimegraph.platform.repository.ScreeningHitRepository;
import com.fincrimegraph.platform.repository.ScreeningRunRepository;
import com.fincrimegraph.platform.repository.WatchlistEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class WatchlistScreeningService {

    private final CustomerRepository customerRepository;
    private final WatchlistEntryRepository watchlistEntryRepository;
    private final ScreeningRunRepository screeningRunRepository;
    private final ScreeningHitRepository screeningHitRepository;
    private final WatchlistMatcher matcher;

    public WatchlistScreeningService(
            CustomerRepository customerRepository,
            WatchlistEntryRepository watchlistEntryRepository,
            ScreeningRunRepository screeningRunRepository,
            ScreeningHitRepository screeningHitRepository,
            WatchlistMatcher matcher
    ) {
        this.customerRepository =
                customerRepository;

        this.watchlistEntryRepository =
                watchlistEntryRepository;

        this.screeningRunRepository =
                screeningRunRepository;

        this.screeningHitRepository =
                screeningHitRepository;

        this.matcher =
                matcher;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<WatchlistEntryView> entries() {
        return watchlistEntryRepository
                .findAllByOrderByFullNameAsc()
                .stream()
                .map(
                        this::toEntryView
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<ScreeningRunView> runs() {
        return screeningRunRepository
                .findTop20ByOrderByStartedAtDesc()
                .stream()
                .map(
                        this::toRunView
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<ScreeningHitView> hits(
            UUID runId
    ) {
        screeningRunRepository
                .findById(
                        runId
                )
                .orElseThrow(
                        () ->
                                new IllegalArgumentException(
                                        "Screening run not found: "
                                                + runId
                                )
                );

        return screeningHitRepository
                .findByRun_IdOrderByMatchScoreDescCreatedAtAsc(
                        runId
                )
                .stream()
                .map(
                        this::toHitView
                )
                .toList();
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public ScreeningRunView run(
            String triggeredBy
    ) {
        String actor =
                requireText(
                        triggeredBy,
                        "triggeredBy",
                        180
                );

        List<CustomerEntity> customers =
                customerRepository
                        .findAll();

        List<WatchlistEntryEntity> entries =
                watchlistEntryRepository
                        .findByActiveTrueOrderByFullNameAsc();

        Instant startedAt =
                Instant.now();

        ScreeningRunEntity run =
                screeningRunRepository
                        .save(
                                new ScreeningRunEntity(
                                        UUID.randomUUID(),
                                        customers.size(),
                                        entries.size(),
                                        actor,
                                        startedAt
                                )
                        );

        int hits =
                0;

        for (
                CustomerEntity customer
                        : customers
        ) {
            for (
                    WatchlistEntryEntity entry
                            : entries
            ) {
                WatchlistMatcher.MatchResult match =
                        matcher.match(
                                customer,
                                entry
                        );

                if (
                        !match.matched()
                ) {
                    continue;
                }

                screeningHitRepository
                        .save(
                                new ScreeningHitEntity(
                                        UUID.randomUUID(),
                                        run,
                                        entry,
                                        customer,
                                        match.matchedName(),
                                        match.nameScore(),
                                        match.countryMatch(),
                                        match.matchScore(),
                                        Instant.now()
                                )
                        );

                hits++;
            }
        }

        run.complete(
                hits,
                Instant.now()
        );

        ScreeningRunEntity saved =
                screeningRunRepository
                        .save(
                                run
                        );

        return toRunView(
                saved
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public ScreeningHitView review(
            UUID hitId,
            String decision,
            String note,
            String reviewedBy
    ) {
        ScreeningHitEntity hit =
                screeningHitRepository
                        .findById(
                                hitId
                        )
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Screening hit not found: "
                                                        + hitId
                                        )
                        );

        ScreeningHitEntity.ReviewStatus
                status =
                parseReviewStatus(
                        decision
                );

        String normalizedNote =
                requireText(
                        note,
                        "review note",
                        2000
                );

        String actor =
                requireText(
                        reviewedBy,
                        "reviewedBy",
                        180
                );

        hit.review(
                status,
                normalizedNote,
                actor,
                Instant.now()
        );

        return toHitView(
                screeningHitRepository
                        .save(
                                hit
                        )
        );
    }

    private ScreeningHitEntity.ReviewStatus
    parseReviewStatus(
            String value
    ) {
        String normalized =
                requireText(
                        value,
                        "decision",
                        40
                )
                        .toUpperCase(
                                Locale.ROOT
                        );

        if (
                !"CLEARED".equals(
                        normalized
                )
                        && !"ESCALATED".equals(
                        normalized
                )
        ) {
            throw new IllegalArgumentException(
                    "Review decision must be CLEARED or ESCALATED."
            );
        }

        return ScreeningHitEntity
                .ReviewStatus
                .valueOf(
                        normalized
                );
    }

    private String requireText(
            String value,
            String field,
            int maximum
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

        String normalized =
                value.trim();

        if (
                normalized.length()
                        > maximum
        ) {
            throw new IllegalArgumentException(
                    field
                            + " exceeds "
                            + maximum
                            + " characters."
            );
        }

        return normalized;
    }

    private WatchlistEntryView toEntryView(
            WatchlistEntryEntity entry
    ) {
        return new WatchlistEntryView(
                entry.getId()
                        .toString(),
                entry.getListKey(),
                entry.getFullName(),
                entry.getAliases(),
                entry.getCountryCode(),
                entry.getCategory()
                        .name(),
                entry.getRiskLevel()
                        .name(),
                entry.getSourceName(),
                entry.getSourceReference(),
                entry.isActive(),
                entry.getUpdatedAt()
        );
    }

    private ScreeningRunView toRunView(
            ScreeningRunEntity run
    ) {
        return new ScreeningRunView(
                run.getId()
                        .toString(),
                run.getStatus()
                        .name(),
                run.getCustomersScanned(),
                run.getEntriesScanned(),
                run.getHitsFound(),
                run.getTriggeredBy(),
                run.getStartedAt(),
                run.getCompletedAt()
        );
    }

    private ScreeningHitView toHitView(
            ScreeningHitEntity hit
    ) {
        CustomerEntity customer =
                hit.getCustomer();

        WatchlistEntryEntity entry =
                hit.getWatchlistEntry();

        return new ScreeningHitView(
                hit.getId()
                        .toString(),
                hit.getRun()
                        .getId()
                        .toString(),
                customer.getId()
                        .toString(),
                customer.getFullName(),
                customer.getCountryCode(),
                customer.getRiskTier()
                        .name(),
                entry.getId()
                        .toString(),
                entry.getListKey(),
                entry.getFullName(),
                entry.getCountryCode(),
                entry.getCategory()
                        .name(),
                entry.getRiskLevel()
                        .name(),
                entry.getSourceName(),
                entry.getSourceReference(),
                hit.getMatchedName(),
                hit.getNameScore(),
                hit.isCountryMatch(),
                hit.getMatchScore(),
                hit.getStatus()
                        .name(),
                hit.getReviewNote(),
                hit.getReviewedBy(),
                hit.getReviewedAt(),
                hit.getCreatedAt()
        );
    }

    public record WatchlistEntryView(
            String id,
            String listKey,
            String fullName,
            String aliases,
            String countryCode,
            String category,
            String riskLevel,
            String sourceName,
            String sourceReference,
            boolean active,
            Instant updatedAt
    ) {
    }

    public record ScreeningRunView(
            String id,
            String status,
            int customersScanned,
            int entriesScanned,
            int hitsFound,
            String triggeredBy,
            Instant startedAt,
            Instant completedAt
    ) {
    }

    public record ScreeningHitView(
            String id,
            String runId,
            String customerId,
            String customerName,
            String customerCountryCode,
            String customerRiskTier,
            String watchlistEntryId,
            String listKey,
            String watchlistName,
            String watchlistCountryCode,
            String category,
            String watchlistRiskLevel,
            String sourceName,
            String sourceReference,
            String matchedName,
            int nameScore,
            boolean countryMatch,
            int matchScore,
            String status,
            String reviewNote,
            String reviewedBy,
            Instant reviewedAt,
            Instant createdAt
    ) {
    }
}
