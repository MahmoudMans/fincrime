package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.WatchlistScreeningService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/watchlist")
public class WatchlistScreeningController {

    private final WatchlistScreeningService screeningService;
    private final SecurityAuditService auditService;

    public WatchlistScreeningController(
            WatchlistScreeningService screeningService,
            SecurityAuditService auditService
    ) {
        this.screeningService =
                screeningService;

        this.auditService =
                auditService;
    }

    @GetMapping("/entries")
    public List<
            WatchlistScreeningService.WatchlistEntryView
            > entries() {
        return screeningService
                .entries();
    }

    @GetMapping("/runs")
    public List<
            WatchlistScreeningService.ScreeningRunView
            > runs() {
        return screeningService
                .runs();
    }

    @GetMapping("/runs/{runId}/hits")
    public List<
            WatchlistScreeningService.ScreeningHitView
            > hits(
            @PathVariable
            UUID runId
    ) {
        return screeningService
                .hits(
                        runId
                );
    }

    @PostMapping("/runs")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public WatchlistScreeningService.ScreeningRunView
    run(
            Authentication authentication
    ) {
        WatchlistScreeningService.ScreeningRunView result =
                screeningService
                        .run(
                                authentication
                                        .getName()
                        );

        auditService.record(
                authentication.getName(),
                "WATCHLIST_SCREENING_RUN",
                "SCREENING_RUN",
                result.id(),
                "SUCCESS",
                "Screened "
                        + result.customersScanned()
                        + " customers against "
                        + result.entriesScanned()
                        + " active synthetic watchlist entries and found "
                        + result.hitsFound()
                        + " matches."
        );

        return result;
    }

    @PostMapping("/hits/{hitId}/review")
    @PreAuthorize(
            "hasAnyRole('AML_ANALYST','SENIOR_ANALYST','ADMIN')"
    )
    public WatchlistScreeningService.ScreeningHitView
    review(
            @PathVariable
            UUID hitId,

            @RequestParam
            String decision,

            @RequestParam
            String note,

            Authentication authentication
    ) {
        WatchlistScreeningService.ScreeningHitView result =
                screeningService
                        .review(
                                hitId,
                                decision,
                                note,
                                authentication
                                        .getName()
                        );

        auditService.record(
                authentication.getName(),
                "WATCHLIST_HIT_REVIEW",
                "SCREENING_HIT",
                result.id(),
                "SUCCESS",
                "Watchlist hit reviewed as "
                        + result.status()
                        + "."
        );

        return result;
    }

    @ResponseStatus(
            HttpStatus.BAD_REQUEST
    )
    @ExceptionHandler(
            IllegalArgumentException.class
    )
    public Map<String, String>
    invalidRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_WATCHLIST_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
