package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.ComplianceOperationsService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/compliance")
public class ComplianceOperationsController {

    private final ComplianceOperationsService operationsService;
    private final SecurityAuditService auditService;

    public ComplianceOperationsController(
            ComplianceOperationsService operationsService,
            SecurityAuditService auditService
    ) {
        this.operationsService =
                operationsService;

        this.auditService =
                auditService;
    }

    @GetMapping("/overview")
    public ComplianceOperationsService.ComplianceOverviewView
    overview() {
        return operationsService
                .overview();
    }

    @GetMapping("/sla/policies")
    public List<
            ComplianceOperationsService.SlaPolicyView
            > policies() {
        return operationsService
                .policies();
    }

    @GetMapping("/sla/cases")
    public List<
            ComplianceOperationsService.CaseSlaView
            > caseSla() {
        return operationsService
                .caseSla();
    }

    @GetMapping("/activity")
    public List<
            ComplianceOperationsService.AuditActivityView
            > activity() {
        return operationsService
                .activity();
    }

    @PostMapping("/sla/recalculate")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public ComplianceOperationsService.SlaRecalculationView
    recalculateSla(
            Authentication authentication
    ) {
        ComplianceOperationsService.SlaRecalculationView result =
                operationsService
                        .recalculateSla();

        auditService.record(
                authentication.getName(),
                "COMPLIANCE_SLA_RECALCULATION",
                "COMPLIANCE_SLA",
                "CASE_PORTFOLIO",
                "SUCCESS",
                "Evaluated "
                        + result.casesEvaluated()
                        + " investigation cases; "
                        + result.breachCount()
                        + " are outside the configured demo SLA."
        );

        return result;
    }
}
