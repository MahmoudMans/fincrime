package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.EvidenceChainOfCustodyService;
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
        "/api/v1/evidence-custody"
)
public class EvidenceChainOfCustodyController {

    private final EvidenceChainOfCustodyService service;
    private final SecurityAuditService auditService;

    public EvidenceChainOfCustodyController(
            EvidenceChainOfCustodyService service,
            SecurityAuditService auditService
    ) {
        this.service =
                service;

        this.auditService =
                auditService;
    }

    @GetMapping
    public List<
            EvidenceChainOfCustodyService.EvidenceView
            > registry() {
        return service.registry();
    }

    @GetMapping(
            "/{evidenceId}/events"
    )
    public List<
            EvidenceChainOfCustodyService.CustodyEventView
            > events(
            @PathVariable
            UUID evidenceId
    ) {
        return service.events(
                evidenceId
        );
    }

    @PostMapping(
            "/cases/{caseId}/register"
    )
    public EvidenceChainOfCustodyService.EvidenceView
    register(
            @PathVariable
            UUID caseId,
            @RequestParam
            String evidenceReference,
            @RequestParam
            String evidenceType,
            @RequestParam
            String title,
            @RequestParam
            String sourceReference,
            @RequestParam
            String description,
            @RequestParam
            String contentSha256,
            Authentication authentication
    ) {
        EvidenceChainOfCustodyService.EvidenceView
                result =
                service.register(
                        caseId,
                        evidenceReference,
                        evidenceType,
                        title,
                        sourceReference,
                        description,
                        contentSha256,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "EVIDENCE_REGISTERED",
                "INVESTIGATION_EVIDENCE",
                result.id(),
                "SUCCESS",
                "Registered evidence "
                        + result.evidenceReference()
                        + " for investigation case "
                        + result.caseNumber()
                        + "."
        );

        return result;
    }

    @PostMapping(
            "/{evidenceId}/transfer"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public EvidenceChainOfCustodyService.EvidenceView
    transfer(
            @PathVariable
            UUID evidenceId,
            @RequestParam
            String toCustodian,
            @RequestParam
            String transferNote,
            Authentication authentication
    ) {
        EvidenceChainOfCustodyService.EvidenceView
                result =
                service.transfer(
                        evidenceId,
                        toCustodian,
                        transferNote,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "EVIDENCE_CUSTODY_TRANSFERRED",
                "INVESTIGATION_EVIDENCE",
                result.id(),
                "SUCCESS",
                "Transferred custody of "
                        + result.evidenceReference()
                        + " to "
                        + result.currentCustodian()
                        + "."
        );

        return result;
    }

    @PostMapping(
            "/{evidenceId}/verify"
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public EvidenceChainOfCustodyService.IntegrityVerificationView
    verify(
            @PathVariable
            UUID evidenceId,
            Authentication authentication
    ) {
        EvidenceChainOfCustodyService.IntegrityVerificationView
                result =
                service.verify(
                        evidenceId,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "EVIDENCE_INTEGRITY_VERIFIED",
                "INVESTIGATION_EVIDENCE",
                evidenceId.toString(),
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
                "INVALID_EVIDENCE_CUSTODY_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
