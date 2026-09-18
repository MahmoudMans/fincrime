package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.DetectionRuleService;
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

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/detection-rules")
public class DetectionRuleController {

    private final DetectionRuleService ruleService;
    private final SecurityAuditService auditService;

    public DetectionRuleController(
            DetectionRuleService ruleService,
            SecurityAuditService auditService
    ) {
        this.ruleService =
                ruleService;

        this.auditService =
                auditService;
    }

    @GetMapping
    public List<
            DetectionRuleService.RuleView
            > rules() {
        return ruleService.rules();
    }

    @GetMapping("/{ruleKey}/history")
    public List<
            DetectionRuleService.RuleChangeView
            > history(
            @PathVariable
            String ruleKey
    ) {
        return ruleService.history(
                ruleKey
        );
    }

    @PostMapping("/{ruleKey}")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public DetectionRuleService.RuleView update(
            @PathVariable
            String ruleKey,

            @RequestParam(required = false)
            Boolean enabled,

            @RequestParam(required = false)
            String severity,

            @RequestParam(required = false)
            Integer riskScore,

            @RequestParam(required = false)
            BigDecimal primaryAmountThreshold,

            @RequestParam(required = false)
            BigDecimal secondaryAmountThreshold,

            @RequestParam(required = false)
            BigDecimal aggregateAmountThreshold,

            @RequestParam(required = false)
            Integer minimumOccurrences,

            @RequestParam(required = false)
            Integer windowMinutes,

            @RequestParam
            String changeSummary,

            Authentication authentication
    ) {
        DetectionRuleService.RuleView updated =
                ruleService.update(
                        ruleKey,
                        enabled,
                        severity,
                        riskScore,
                        primaryAmountThreshold,
                        secondaryAmountThreshold,
                        aggregateAmountThreshold,
                        minimumOccurrences,
                        windowMinutes,
                        authentication.getName(),
                        changeSummary
                );

        auditService.record(
                authentication.getName(),
                "AML_RULE_UPDATE",
                "DETECTION_RULE",
                updated.ruleKey(),
                "SUCCESS",
                "Rule "
                        + updated.ruleKey()
                        + " updated to version "
                        + updated.version()
                        + "."
        );

        return updated;
    }

    @ResponseStatus(
            HttpStatus.BAD_REQUEST
    )
    @ExceptionHandler(
            IllegalArgumentException.class
    )
    public Map<String, String>
    invalidRuleRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_DETECTION_RULE_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
