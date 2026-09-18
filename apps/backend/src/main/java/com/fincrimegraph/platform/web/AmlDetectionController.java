package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.AmlDetectionService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/detection-runs")
public class AmlDetectionController {

    private final AmlDetectionService detectionService;

    public AmlDetectionController(
            AmlDetectionService detectionService
    ) {
        this.detectionService = detectionService;
    }

    @PostMapping("/run")
    public AmlDetectionService.DetectionRunView run() {
        return detectionService.runDetection();
    }

    @GetMapping
    public List<AmlDetectionService.DetectionRunView> recent() {
        return detectionService.recentRuns();
    }
}
