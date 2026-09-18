package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.DecisionExecutionService;
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
@RequestMapping(
        "/api/v1/decision-execution"
)
public class DecisionExecutionController {

    private final DecisionExecutionService service;
    private final SecurityAuditService auditService;

    public DecisionExecutionController(
            DecisionExecutionService service,
            SecurityAuditService auditService
    ) {
        this.service =
                service;

        this.auditService =
                auditService;
    }

    @GetMapping("/executions")
    public List<
            DecisionExecutionService.ExecutionView
            > executions() {
        return service.executions();
    }

    @GetMapping("/outcomes")
    public List<
            DecisionExecutionService.OutcomeView
            > outcomes() {
        return service.outcomes();
    }

    @GetMapping(
            "/cases/{caseId}/outcome"
    )
    public DecisionExecutionService.OutcomeView
    caseOutcome(
            @PathVariable
            UUID caseId
    ) {
        return service.caseOutcome(
                caseId
        );
    }

    @PostMapping(
            "/proposals/{proposalId}/execute"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public DecisionExecutionService.ExecutionView
    execute(
            @PathVariable
            UUID proposalId,
            @RequestParam
            String executionNote,
            Authentication authentication
    ) {
        DecisionExecutionService.ExecutionView
                result =
                service.execute(
                        proposalId,
                        executionNote,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CASE_DECISION_EXECUTED",
                "INVESTIGATION_CASE",
                result.caseId(),
                "SUCCESS",
                "Executed approved decision proposal "
                        + proposalId
                        + " version "
                        + result.decisionVersion()
                        + " as governed outcome "
                        + result.governedOutcome()
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
                "INVALID_DECISION_EXECUTION_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
