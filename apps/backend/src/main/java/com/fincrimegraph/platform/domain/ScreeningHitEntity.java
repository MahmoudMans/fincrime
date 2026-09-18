package com.fincrimegraph.platform.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "screening_hits")
public class ScreeningHitEntity {

    public enum ReviewStatus {
        PENDING_REVIEW,
        CLEARED,
        ESCALATED
    }

    @Id
    private UUID id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "run_id",
            nullable = false
    )
    private ScreeningRunEntity run;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "watchlist_entry_id",
            nullable = false
    )
    private WatchlistEntryEntity watchlistEntry;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "customer_id",
            nullable = false
    )
    private CustomerEntity customer;

    @Column(
            name = "matched_name",
            nullable = false,
            length = 220
    )
    private String matchedName;

    @Column(
            name = "name_score",
            nullable = false
    )
    private int nameScore;

    @Column(
            name = "country_match",
            nullable = false
    )
    private boolean countryMatch;

    @Column(
            name = "match_score",
            nullable = false
    )
    private int matchScore;

    @Enumerated(EnumType.STRING)
    @Column(
            nullable = false,
            length = 40
    )
    private ReviewStatus status;

    @Column(
            name = "review_note",
            length = 2000
    )
    private String reviewNote;

    @Column(
            name = "reviewed_by",
            length = 180
    )
    private String reviewedBy;

    @Column(
            name = "reviewed_at"
    )
    private Instant reviewedAt;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected ScreeningHitEntity() {
    }

    public ScreeningHitEntity(
            UUID id,
            ScreeningRunEntity run,
            WatchlistEntryEntity watchlistEntry,
            CustomerEntity customer,
            String matchedName,
            int nameScore,
            boolean countryMatch,
            int matchScore,
            Instant createdAt
    ) {
        this.id = id;
        this.run = run;
        this.watchlistEntry =
                watchlistEntry;
        this.customer = customer;
        this.matchedName =
                matchedName;
        this.nameScore =
                nameScore;
        this.countryMatch =
                countryMatch;
        this.matchScore =
                matchScore;
        this.status =
                ReviewStatus.PENDING_REVIEW;
        this.createdAt =
                createdAt;
    }

    public void review(
            ReviewStatus status,
            String reviewNote,
            String reviewedBy,
            Instant reviewedAt
    ) {
        if (
                status ==
                ReviewStatus.PENDING_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Review decision cannot be PENDING_REVIEW."
            );
        }

        this.status = status;
        this.reviewNote =
                reviewNote;
        this.reviewedBy =
                reviewedBy;
        this.reviewedAt =
                reviewedAt;
    }

    public UUID getId() {
        return id;
    }

    public ScreeningRunEntity getRun() {
        return run;
    }

    public WatchlistEntryEntity getWatchlistEntry() {
        return watchlistEntry;
    }

    public CustomerEntity getCustomer() {
        return customer;
    }

    public String getMatchedName() {
        return matchedName;
    }

    public int getNameScore() {
        return nameScore;
    }

    public boolean isCountryMatch() {
        return countryMatch;
    }

    public int getMatchScore() {
        return matchScore;
    }

    public ReviewStatus getStatus() {
        return status;
    }

    public String getReviewNote() {
        return reviewNote;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
