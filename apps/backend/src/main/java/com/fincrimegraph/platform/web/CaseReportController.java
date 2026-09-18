package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.CaseReportService;
import com.fincrimegraph.platform.service.CaseWorkspaceService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/case-reports")
public class CaseReportController {

    private final CaseWorkspaceService workspaceService;
    private final CaseReportService reportService;
    private final SecurityAuditService auditService;

    public CaseReportController(
            CaseWorkspaceService workspaceService,
            CaseReportService reportService,
            SecurityAuditService auditService
    ) {
        this.workspaceService =
                workspaceService;

        this.reportService =
                reportService;

        this.auditService =
                auditService;
    }

    @GetMapping(
            value = "/{caseId}.pdf",
            produces = MediaType.APPLICATION_PDF_VALUE
    )
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public ResponseEntity<byte[]> export(
            @PathVariable
            UUID caseId,

            Authentication authentication
    ) {
        CaseWorkspaceService.CaseWorkspaceView workspace =
                workspaceService
                        .workspace(
                                caseId
                        );

        byte[] report =
                reportService
                        .render(
                                workspace,
                                authentication
                                        .getName()
                        );

        String filename =
                "fincrime-case-"
                        + safeFilename(
                        workspace
                                .caseNumber()
                )
                        + ".pdf";

        auditService.record(
                authentication.getName(),
                "CASE_REPORT_EXPORT",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Generated investigation PDF report "
                        + filename
                        + "."
        );

        return ResponseEntity
                .ok()
                .contentType(
                        MediaType.APPLICATION_PDF
                )
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition
                                .attachment()
                                .filename(
                                        filename
                                )
                                .build()
                                .toString()
                )
                .contentLength(
                        report.length
                )
                .body(
                        report
                );
    }

    private String safeFilename(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return "investigation";
        }

        return value
                .replaceAll(
                        "[^A-Za-z0-9._-]",
                        "_"
                );
    }
}
