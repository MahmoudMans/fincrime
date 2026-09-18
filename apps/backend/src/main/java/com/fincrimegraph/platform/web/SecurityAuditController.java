package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/security")
public class SecurityAuditController {

    private final SecurityAuditService auditService;

    public SecurityAuditController(
            SecurityAuditService auditService
    ) {
        this.auditService = auditService;
    }

    @GetMapping("/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public List<
            SecurityAuditService.AuditView
            > audit() {
        return auditService.recent();
    }
}
