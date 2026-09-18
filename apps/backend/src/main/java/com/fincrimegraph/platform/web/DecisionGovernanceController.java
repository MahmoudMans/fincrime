package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.DecisionGovernanceService;
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
@RequestMapping("/api/v1/decision-governance")
public class DecisionGovernanceController {

    private final DecisionGovernanceService service;
    private final SecurityAuditService auditService;

    public DecisionGovernanceController(
            DecisionGovernanceService service,
            SecurityAuditService auditService
    ) {
        this.service = service;
        this.auditService = auditService;
    }

    @GetMapping("/pending")
    public List<DecisionGovernanceService.DecisionView>
    pending() {
        return service.pending();
    }

    @GetMapping("/proposals")
    public List<DecisionGovernanceService.DecisionView>
    recent() {
        return service.recent();
    }

    @GetMapping("/cases/{caseId}/history")
    public List<DecisionGovernanceService.DecisionView>
    history(
            @PathVariable UUID caseId
    ) {
        return service.caseHistory(caseId);
    }

    @PostMapping("/cases/{caseId}/proposals")
    public DecisionGovernanceService.DecisionView
    submit(
            @PathVariable UUID caseId,
            @RequestParam String recommendation,
            @RequestParam String rationale,
            Authentication authentication
    ) {
        DecisionGovernanceService.DecisionView result =
                service.submit(
                        caseId,
                        recommendation,
                        rationale,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CASE_DECISION_SUBMITTED",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Submitted decision proposal "
                        + result.id()
                        + " version "
                        + result.version()
                        + " with recommendation "
                        + result.recommendation()
                        + "."
        );

        return result;
    }

    @PostMapping("/proposals/{proposalId}/review")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public DecisionGovernanceService.DecisionView
    review(
            @PathVariable UUID proposalId,
            @RequestParam String decision,
            @RequestParam String reviewNote,
            Authentication authentication
    ) {
        DecisionGovernanceService.DecisionView result =
                service.review(
                        proposalId,
                        decision,
                        reviewNote,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CASE_DECISION_REVIEWED",
                "INVESTIGATION_CASE",
                result.caseId(),
                "SUCCESS",
                "Reviewed proposal "
                        + proposalId
                        + " with decision "
                        + result.status()
                        + "."
        );

        return result;
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(IllegalArgumentException.class)
    public Map<String, String>
    invalidRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_DECISION_GOVERNANCE_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
