package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.InvestigationFindingService;
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
        "/api/v1/investigation-findings"
)
public class InvestigationFindingController {

    private final InvestigationFindingService service;
    private final SecurityAuditService auditService;

    public InvestigationFindingController(
            InvestigationFindingService service,
            SecurityAuditService auditService
    ) {
        this.service =
                service;

        this.auditService =
                auditService;
    }

    @GetMapping
    public List<
            InvestigationFindingService.FindingView
            > findings() {
        return service.findings();
    }

    @GetMapping(
            "/cases/{caseId}"
    )
    public List<
            InvestigationFindingService.FindingView
            > caseHistory(
            @PathVariable
            UUID caseId
    ) {
        return service.caseHistory(
                caseId
        );
    }

    @PostMapping(
            "/cases/{caseId}"
    )
    @PreAuthorize(
            "hasRole('AML_ANALYST')"
    )
    public InvestigationFindingService.FindingView
    submit(
            @PathVariable
            UUID caseId,
            @RequestParam
            String findingReference,
            @RequestParam
            String title,
            @RequestParam
            String narrative,
            @RequestParam
            UUID evidenceId,
            Authentication authentication
    ) {
        InvestigationFindingService.FindingView
                result =
                service.submit(
                        caseId,
                        findingReference,
                        title,
                        narrative,
                        evidenceId,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "INVESTIGATION_FINDING_SUBMITTED",
                "INVESTIGATION_FINDING",
                result.id(),
                "SUCCESS",
                "Submitted finding "
                        + result.findingReference()
                        + " version "
                        + result.findingVersion()
                        + " using evidence review "
                        + result.evidenceReviewId()
                        + "."
        );

        return result;
    }

    @PostMapping(
            "/{findingId}/review"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public InvestigationFindingService.FindingView
    review(
            @PathVariable
            UUID findingId,
            @RequestParam
            String decision,
            @RequestParam
            String reviewNote,
            Authentication authentication
    ) {
        InvestigationFindingService.FindingView
                result =
                service.review(
                        findingId,
                        decision,
                        reviewNote,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "INVESTIGATION_FINDING_REVIEWED",
                "INVESTIGATION_FINDING",
                result.id(),
                "SUCCESS",
                "Reviewed finding "
                        + result.findingReference()
                        + " version "
                        + result.findingVersion()
                        + " with decision "
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
                "INVALID_INVESTIGATION_FINDING_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
