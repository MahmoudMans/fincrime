package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.AuditRange;
import com.fincrimegraph.platform.security.SecurityAuditService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/security")
public class SecurityAuditController {

    private final SecurityAuditService auditService;

    public SecurityAuditController(
            SecurityAuditService auditService
    ) {
        this.auditService = auditService;
    }

    @GetMapping("/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public List<
            SecurityAuditService.AuditView
            > audit() {
        return auditService.recent();
    }

    /**
     * Events inside an optional time range, newest first. "from" and
     * "to" are ISO-8601 instants (both ends included); "page" starts
     * at 0 and "size" is capped at 500.
     */
    @GetMapping("/audit/search")
    @PreAuthorize("hasRole('ADMIN')")
    public SecurityAuditService.AuditPageView search(
            @RequestParam(required = false)
            String from,

            @RequestParam(required = false)
            String to,

            @RequestParam(required = false)
            Integer page,

            @RequestParam(required = false)
            Integer size
    ) {
        return auditService.search(
                AuditRange.of(
                        from,
                        to,
                        page,
                        size,
                        Instant.now()
                )
        );
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
                "INVALID_AUDIT_QUERY",
                "message",
                exception.getMessage()
        );
    }
}
