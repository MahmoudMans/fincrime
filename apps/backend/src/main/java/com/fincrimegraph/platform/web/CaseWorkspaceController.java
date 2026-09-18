package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.CaseWorkspaceService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/case-workspace")
public class CaseWorkspaceController {

    private final CaseWorkspaceService workspaceService;

    public CaseWorkspaceController(
            CaseWorkspaceService workspaceService
    ) {
        this.workspaceService =
                workspaceService;
    }

    @GetMapping("/{caseId}")
    public CaseWorkspaceService.CaseWorkspaceView
    workspace(
            @PathVariable UUID caseId
    ) {
        return workspaceService.workspace(
                caseId
        );
    }

    @PostMapping("/{caseId}/notes")
    public CaseWorkspaceService.CaseWorkspaceView
    addNote(
            @PathVariable UUID caseId,

            @RequestParam(
                    defaultValue = "AML Analyst"
            )
            String author,

            @RequestParam
            String body
    ) {
        return workspaceService.addNote(
                caseId,
                author,
                body
        );
    }

    @PostMapping("/{caseId}/assign")
    public CaseWorkspaceService.CaseWorkspaceView
    assign(
            @PathVariable UUID caseId,

            @RequestParam
            String assignee,

            @RequestParam(
                    defaultValue = "AML Analyst"
            )
            String actor
    ) {
        return workspaceService.assign(
                caseId,
                assignee,
                actor
        );
    }

    @PostMapping(
            "/{caseId}/evidence/alerts/{alertId}"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    attachAlert(
            @PathVariable UUID caseId,
            @PathVariable UUID alertId,

            @RequestParam(
                    defaultValue = "AML Analyst"
            )
            String actor
    ) {
        return workspaceService.attachAlert(
                caseId,
                alertId,
                actor
        );
    }

    @PostMapping(
            "/{caseId}/evidence/transactions/{reference}"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    attachTransaction(
            @PathVariable UUID caseId,
            @PathVariable String reference,

            @RequestParam(
                    defaultValue = "AML Analyst"
            )
            String actor
    ) {
        return workspaceService.attachTransaction(
                caseId,
                reference,
                actor
        );
    }

    @PostMapping(
            "/{caseId}/evidence/graph/circular-flows"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    attachCircularFlows(
            @PathVariable UUID caseId,

            @RequestParam(
                    defaultValue = "AML Analyst"
            )
            String actor
    ) {
        return workspaceService.attachCircularGraph(
                caseId,
                actor
        );
    }

    @PostMapping("/{caseId}/resolve")
    public CaseWorkspaceService.CaseWorkspaceView
    resolve(
            @PathVariable UUID caseId,

            @RequestParam
            String disposition,

            @RequestParam
            String summary,

            @RequestParam(
                    defaultValue = "AML Analyst"
            )
            String actor
    ) {
        return workspaceService.resolve(
                caseId,
                disposition,
                summary,
                actor
        );
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(IllegalArgumentException.class)
    public Map<String, String> invalidRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_CASE_WORKSPACE_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
