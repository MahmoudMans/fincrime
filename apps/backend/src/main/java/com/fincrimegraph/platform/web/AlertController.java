package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.AlertQueryService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/alerts")
public class AlertController {

    private final AlertQueryService alertQueryService;

    public AlertController(
            AlertQueryService alertQueryService
    ) {
        this.alertQueryService = alertQueryService;
    }

    /**
     * Searchable, filterable and paged alert queue.
     *
     * status:   OPEN, IN_REVIEW, CLOSED (omit or ALL for everything)
     * severity: LOW, MEDIUM, HIGH, CRITICAL (omit or ALL for everything)
     * q:        free text matched against title, code and description
     * page:     zero-based page index
     * size:     page size, capped at 100
     */
    @GetMapping
    public AlertQueryService.AlertPage search(
            @RequestParam(required = false)
            String status,

            @RequestParam(required = false)
            String severity,

            @RequestParam(
                    name = "q",
                    required = false
            )
            String query,

            @RequestParam(defaultValue = "0")
            int page,

            @RequestParam(defaultValue = "25")
            int size
    ) {
        return alertQueryService.search(
                status,
                severity,
                query,
                page,
                size
        );
    }

    @ResponseStatus(
            HttpStatus.BAD_REQUEST
    )
    @ExceptionHandler(
            IllegalArgumentException.class
    )
    public Map<String, String> invalidRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_ALERT_QUERY",
                "message",
                exception.getMessage()
        );
    }
}
