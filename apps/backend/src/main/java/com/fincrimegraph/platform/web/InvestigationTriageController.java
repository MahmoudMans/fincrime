package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.InvestigationTriageService;
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
@RequestMapping("/api/v1/investigation-triage")
public class InvestigationTriageController {

    private final InvestigationTriageService triageService;
    private final SecurityAuditService auditService;

    public InvestigationTriageController(
            InvestigationTriageService triageService,
            SecurityAuditService auditService
    ) {
        this.triageService =
                triageService;

        this.auditService =
                auditService;
    }

    @GetMapping("/queue")
    public List<
            InvestigationTriageService.QueueItemView
            > queue() {
        return triageService
                .queue();
    }

    @GetMapping("/runs")
    public List<
            InvestigationTriageService.TriageRunSummaryView
            > runs() {
        return triageService
                .history();
    }

    @PostMapping("/recalculate")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public InvestigationTriageService.TriageRunView
    recalculate(
            Authentication authentication
    ) {
        InvestigationTriageService.TriageRunView result =
                triageService
                        .recalculate(
                                authentication.getName()
                        );

        auditService.record(
                authentication.getName(),
                "INVESTIGATION_TRIAGE_RECALCULATION",
                "TRIAGE_RUN",
                result.id(),
                "SUCCESS",
                "Calculated explainable triage scores for "
                        + result.caseCount()
                        + " investigation cases."
        );

        return result;
    }

    @PostMapping(
            "/cases/{caseId}/owner"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public InvestigationTriageService.OwnershipView
    assignOwner(
            @PathVariable
            UUID caseId,
            @RequestParam
            String ownerUsername,
            @RequestParam
            String assignmentNote,
            Authentication authentication
    ) {
        InvestigationTriageService.OwnershipView result =
                triageService
                        .assignOwner(
                                caseId,
                                ownerUsername,
                                authentication.getName(),
                                assignmentNote
                        );

        auditService.record(
                authentication.getName(),
                "INVESTIGATION_OWNER_ASSIGNMENT",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Assigned queue owner "
                        + result.ownerUsername()
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
                "INVALID_TRIAGE_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
