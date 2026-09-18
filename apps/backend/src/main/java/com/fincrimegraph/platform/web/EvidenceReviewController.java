package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.EvidenceReviewService;
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
        "/api/v1/evidence-reviews"
)
public class EvidenceReviewController {

    private final EvidenceReviewService service;
    private final SecurityAuditService auditService;

    public EvidenceReviewController(
            EvidenceReviewService service,
            SecurityAuditService auditService
    ) {
        this.service =
                service;

        this.auditService =
                auditService;
    }

    @GetMapping
    public List<
            EvidenceReviewService.ReviewView
            > reviews() {
        return service.reviews();
    }

    @GetMapping(
            "/evidence/{evidenceId}"
    )
    public List<
            EvidenceReviewService.ReviewView
            > evidenceHistory(
            @PathVariable
            UUID evidenceId
    ) {
        return service.evidenceHistory(
                evidenceId
        );
    }

    @PostMapping(
            "/evidence/{evidenceId}"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public EvidenceReviewService.ReviewView
    review(
            @PathVariable
            UUID evidenceId,
            @RequestParam
            String reviewDecision,
            @RequestParam
            String reviewReason,
            Authentication authentication
    ) {
        EvidenceReviewService.ReviewView
                result =
                service.review(
                        evidenceId,
                        reviewDecision,
                        reviewReason,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "EVIDENCE_REVIEW_RECORDED",
                "INVESTIGATION_EVIDENCE",
                evidenceId.toString(),
                "SUCCESS",
                "Recorded evidence review version "
                        + result.reviewVersion()
                        + " with decision "
                        + result.reviewDecision()
                        + " anchored to registry fingerprint "
                        + result.registryFingerprint()
                        + " and custody head "
                        + result.custodyHeadHash()
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
                "INVALID_EVIDENCE_REVIEW_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
