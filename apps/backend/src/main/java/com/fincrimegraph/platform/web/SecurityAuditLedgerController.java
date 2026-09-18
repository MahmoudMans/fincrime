package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.SecurityAuditLedgerService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/security-ledger")
@PreAuthorize(
        "hasRole('ADMIN')"
)
public class SecurityAuditLedgerController {

    private final SecurityAuditLedgerService ledgerService;
    private final SecurityAuditService auditService;

    public SecurityAuditLedgerController(
            SecurityAuditLedgerService ledgerService,
            SecurityAuditService auditService
    ) {
        this.ledgerService =
                ledgerService;

        this.auditService =
                auditService;
    }

    @GetMapping("/status")
    public SecurityAuditLedgerService.LedgerStatusView
    status() {
        return ledgerService
                .status();
    }

    @GetMapping("/history")
    public List<
            SecurityAuditLedgerService.VerificationHistoryView
            > history() {
        return ledgerService
                .verificationHistory();
    }

    @PostMapping("/refresh")
    public SecurityAuditLedgerService.LedgerRefreshView
    refresh(
            Authentication authentication
    ) {
        auditService.record(
                authentication.getName(),
                "AUDIT_LEDGER_REFRESH",
                "SECURITY_AUDIT_LEDGER",
                "PRIMARY",
                "REQUESTED",
                "Administrator requested security audit ledger refresh and verification."
        );

        return ledgerService
                .refreshAndVerify();
    }
}
