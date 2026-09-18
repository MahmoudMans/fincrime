package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.CaseOutcomeAttestationService;
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
@RequestMapping(
        "/api/v1/outcome-attestations"
)
public class CaseOutcomeAttestationController {

    private final CaseOutcomeAttestationService service;
    private final SecurityAuditService auditService;

    public CaseOutcomeAttestationController(
            CaseOutcomeAttestationService service,
            SecurityAuditService auditService
    ) {
        this.service =
                service;

        this.auditService =
                auditService;
    }

    @GetMapping
    public List<
            CaseOutcomeAttestationService.AttestationView
            > attestations() {
        return service.attestations();
    }

    @GetMapping("/verifications")
    public List<
            CaseOutcomeAttestationService.VerificationView
            > verifications() {
        return service.verifications();
    }

    @PostMapping(
            "/cases/{caseId}/attest"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public CaseOutcomeAttestationService.AttestationView
    attest(
            @PathVariable
            UUID caseId,
            Authentication authentication
    ) {
        CaseOutcomeAttestationService.AttestationView
                result =
                service.attest(
                        caseId,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CASE_OUTCOME_ATTESTED",
                "CASE_OUTCOME_ATTESTATION",
                result.id(),
                "SUCCESS",
                "Created SHA-256 provenance attestation for case "
                        + result.caseId()
                        + " execution "
                        + result.executionId()
                        + "."
        );

        return result;
    }

    @PostMapping(
            "/{attestationId}/verify"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public CaseOutcomeAttestationService.VerificationView
    verify(
            @PathVariable
            UUID attestationId,
            Authentication authentication
    ) {
        CaseOutcomeAttestationService.VerificationView
                result =
                service.verify(
                        attestationId,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "CASE_OUTCOME_ATTESTATION_VERIFIED",
                "CASE_OUTCOME_ATTESTATION",
                attestationId.toString(),
                result.integrityValid()
                        ? "SUCCESS"
                        : "FAILURE",
                result.detail()
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
                "INVALID_OUTCOME_ATTESTATION_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
