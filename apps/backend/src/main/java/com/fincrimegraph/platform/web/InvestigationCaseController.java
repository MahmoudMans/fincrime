package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.InvestigationCaseService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cases")
public class InvestigationCaseController {

    private final InvestigationCaseService caseService;
    private final SecurityAuditService auditService;

    public InvestigationCaseController(
            InvestigationCaseService caseService,
            SecurityAuditService auditService
    ) {
        this.caseService = caseService;
        this.auditService = auditService;
    }

    @GetMapping
    public List<
            InvestigationCaseService.InvestigationCaseView
            > listCases() {
        return caseService.listCases();
    }

    @PostMapping("/from-alert/{alertId}")
    public InvestigationCaseService.InvestigationCaseView
    openFromAlert(
            @PathVariable
            UUID alertId,

            Authentication authentication
    ) {
        var result =
                caseService.openFromAlert(
                        alertId
                );

        auditService.record(
                authentication.getName(),
                "CASE_OPEN_FROM_ALERT",
                "INVESTIGATION_CASE",
                result.id(),
                "SUCCESS",
                "Opened or retrieved case from alert "
                        + result.primaryAlertCode()
                        + "."
        );

        return result;
    }

    @PostMapping("/{caseId}/advance")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public InvestigationCaseService.InvestigationCaseView
    advance(
            @PathVariable
            UUID caseId,

            Authentication authentication
    ) {
        var result =
                caseService.advanceCase(
                        caseId
                );

        auditService.record(
                authentication.getName(),
                "CASE_STATUS_ADVANCE",
                "INVESTIGATION_CASE",
                result.id(),
                "SUCCESS",
                "Advanced case status to "
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
    public Map<String, String> invalidRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_CASE_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
