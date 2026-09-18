package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.CustomerRiskAssessmentService;
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
@RequestMapping("/api/v1/customer-risk")
public class CustomerRiskController {

    private final CustomerRiskAssessmentService riskService;
    private final SecurityAuditService auditService;

    public CustomerRiskController(
            CustomerRiskAssessmentService riskService,
            SecurityAuditService auditService
    ) {
        this.riskService =
                riskService;

        this.auditService =
                auditService;
    }

    @GetMapping("/assessments")
    public List<
            CustomerRiskAssessmentService.AssessmentView
            > assessments() {
        return riskService
                .latestAssessments();
    }

    @GetMapping(
            "/assessments/{assessmentId}/factors"
    )
    public List<
            CustomerRiskAssessmentService.FactorView
            > factors(
            @PathVariable
            UUID assessmentId
    ) {
        return riskService
                .factors(
                        assessmentId
                );
    }

    @GetMapping(
            "/customers/{customerId}/history"
    )
    public List<
            CustomerRiskAssessmentService.AssessmentView
            > history(
            @PathVariable
            UUID customerId
    ) {
        return riskService
                .history(
                        customerId
                );
    }

    @PostMapping("/recalculate")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public CustomerRiskAssessmentService.RiskBatchView
    recalculate(
            Authentication authentication
    ) {
        CustomerRiskAssessmentService.RiskBatchView result =
                riskService
                        .recalculate(
                                authentication
                                        .getName()
                        );

        auditService.record(
                authentication.getName(),
                "CUSTOMER_RISK_RECALCULATION",
                "RISK_BATCH",
                result.batchId(),
                "SUCCESS",
                "Generated "
                        + result.customerCount()
                        + " explainable customer risk assessments using "
                        + result.modelVersion()
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
                "INVALID_CUSTOMER_RISK_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
