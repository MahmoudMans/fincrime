package com.fincrimegraph.platform.web;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

@RestController
@RequestMapping("/api/v1/system")
public class SystemController {

    @GetMapping("/status")
    public SystemStatus status() {
        return new SystemStatus(
                "fincrime-graph",
                "0.1.0",
                "UP",
                Instant.now()
        );
    }

    public record SystemStatus(
            String service,
            String version,
            String status,
            Instant timestamp
    ) {
    }
}
