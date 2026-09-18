package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.InvestigationConclusionReleaseService;
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
        "/api/v1/conclusion-releases"
)
public class InvestigationConclusionReleaseController {

    private final InvestigationConclusionReleaseService service;
    private final SecurityAuditService auditService;

    public InvestigationConclusionReleaseController(
            InvestigationConclusionReleaseService service,
            SecurityAuditService auditService
    ) {
        this.service =
                service;

        this.auditService =
                auditService;
    }

    @GetMapping
    public List<
            InvestigationConclusionReleaseService.PackageView
            > packages() {
        return service.packages();
    }

    @GetMapping(
            "/cases/{caseId}"
    )
    public List<
            InvestigationConclusionReleaseService.PackageView
            > caseHistory(
            @PathVariable
            UUID caseId
    ) {
        return service.caseHistory(
                caseId
        );
    }

    @PostMapping(
            "/findings/{findingId}/prepare"
    )
    @PreAuthorize(
            "hasRole('SENIOR_ANALYST')"
    )
    public InvestigationConclusionReleaseService.PackageView
    prepare(
            @PathVariable
            UUID findingId,
            @RequestParam
            String conclusionSummary,
            @RequestParam
            String releaseRationale,
            Authentication authentication
    ) {
        InvestigationConclusionReleaseService.PackageView
                result =
                service.prepare(
                        findingId,
                        conclusionSummary,
                        releaseRationale,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CONCLUSION_PACKAGE_PREPARED",
                "INVESTIGATION_CONCLUSION_PACKAGE",
                result.id(),
                "SUCCESS",
                "Prepared conclusion package version "
                        + result.packageVersion()
                        + " from approved finding "
                        + result.findingReference()
                        + " version "
                        + result.findingVersion()
                        + "."
        );

        return result;
    }

    @PostMapping(
            "/{packageId}/review"
    )
    @PreAuthorize(
            "hasRole('ADMIN')"
    )
    public InvestigationConclusionReleaseService.PackageView
    review(
            @PathVariable
            UUID packageId,
            @RequestParam
            String decision,
            @RequestParam
            String reviewNote,
            Authentication authentication
    ) {
        InvestigationConclusionReleaseService.PackageView
                result =
                service.review(
                        packageId,
                        decision,
                        reviewNote,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CONCLUSION_PACKAGE_REVIEWED",
                "INVESTIGATION_CONCLUSION_PACKAGE",
                result.id(),
                "SUCCESS",
                "Reviewed conclusion package version "
                        + result.packageVersion()
                        + " with decision "
                        + result.status()
                        + "."
        );

        if (
                "RELEASED".equals(
                        result.status()
                )
        ) {
            auditService.record(
                    authentication.getName(),
                    "INVESTIGATION_CONCLUSION_RELEASED",
                    "INVESTIGATION_CASE",
                    result.caseId(),
                    "SUCCESS",
                    "Released conclusion package "
                            + result.id()
                            + " with fingerprint "
                            + result.releaseFingerprint()
                            + "."
            );
        }

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
                "INVALID_CONCLUSION_RELEASE_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
