package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.DataImportService;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/data-imports")
@PreAuthorize("hasRole('ADMIN')")
public class DataImportController {

    private final DataImportService
            dataImportService;

    private final SecurityAuditService
            auditService;

    public DataImportController(
            DataImportService dataImportService,
            SecurityAuditService auditService
    ) {
        this.dataImportService =
                dataImportService;

        this.auditService =
                auditService;
    }

    @GetMapping("/schemas")
    public List<DataImportService.SchemaView>
    schemas() {
        return dataImportService.schemas();
    }

    @GetMapping
    public List<DataImportService.ImportJobView>
    history() {
        return dataImportService.history();
    }

    @GetMapping("/{jobId}")
    public DataImportService.ImportJobView detail(
            @PathVariable UUID jobId
    ) {
        return dataImportService.detail(jobId);
    }

    @PostMapping(
            value = "/preview",
            consumes =
                    MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public DataImportService.ImportJobView
    preview(
            @RequestPart("file")
            MultipartFile file,

            @RequestParam(
                    name = "datasetType",
                    defaultValue = "AUTO"
            )
            String datasetType,

            Authentication authentication
    ) {
        DataImportService.ImportJobView result =
                dataImportService.preview(
                        file,
                        datasetType,
                        authentication.getName()
                );

        auditService.record(
                authentication.getName(),
                "DATA_IMPORT_PREVIEWED",
                "DATA_IMPORT",
                result.id(),
                "SUCCESS",
                "Validated "
                        + result.datasetType()
                        + " import file "
                        + result.fileName()
                        + " with "
                        + result.validRows()
                        + " valid, "
                        + result.duplicateRows()
                        + " duplicate, and "
                        + result.invalidRows()
                        + " invalid rows."
        );

        return result;
    }

    @PostMapping("/{jobId}/commit")
    public DataImportService.ImportJobView commit(
            @PathVariable UUID jobId,
            Authentication authentication
    ) {
        DataImportService.ImportJobView result =
                dataImportService.commit(
                        jobId
                );

        String outcome =
                "IMPORTED".equals(
                        result.status()
                )
                        ? "SUCCESS"
                        : "BLOCKED";

        auditService.record(
                authentication.getName(),
                "DATA_IMPORT_COMMIT",
                "DATA_IMPORT",
                result.id(),
                outcome,
                "Import status="
                        + result.status()
                        + ", dataset="
                        + result.datasetType()
                        + ", importedRows="
                        + result.importedRows()
                        + ", graphSync="
                        + result.graphSyncStatus()
                        + "."
        );

        return result;
    }

    @PostMapping("/graph/resynchronize")
    public DataImportService.GraphSyncView
    resynchronizeGraph(
            Authentication authentication
    ) {
        DataImportService.GraphSyncView result =
                dataImportService
                        .resynchronizeGraph();

        auditService.record(
                authentication.getName(),
                "DATA_IMPORT_GRAPH_RESYNCHRONIZED",
                "DATA_IMPORT",
                null,
                "SUCCESS",
                "Resynchronized "
                        + result.customers()
                        + " customers, "
                        + result.accounts()
                        + " accounts and "
                        + result.transactions()
                        + " transactions into Neo4j."
        );

        return result;
    }
}
