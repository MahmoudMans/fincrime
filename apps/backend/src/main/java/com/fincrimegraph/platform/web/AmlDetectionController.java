package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.AmlDetectionService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/detection-runs")
public class AmlDetectionController {

    private final AmlDetectionService detectionService;
    private final SecurityAuditService auditService;

    public AmlDetectionController(
            AmlDetectionService detectionService,
            SecurityAuditService auditService
    ) {
        this.detectionService = detectionService;
        this.auditService = auditService;
    }

    @PostMapping("/run")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public AmlDetectionService.DetectionRunView run(
            Authentication authentication
    ) {
        AmlDetectionService.DetectionRunView result =
                detectionService
                        .runDetection();

        auditService.record(
                authentication.getName(),
                "AML_DETECTION_RUN",
                "DETECTION_RUN",
                result.id(),
                "SUCCESS",
                "Executed five AML detection rule families."
        );

        return result;
    }

    @GetMapping
    public List<
            AmlDetectionService.DetectionRunView
            > recent() {
        return detectionService.recentRuns();
    }
}
