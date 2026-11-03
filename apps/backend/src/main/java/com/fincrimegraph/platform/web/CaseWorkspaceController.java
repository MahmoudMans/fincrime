package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.security.SecurityAuditService;
import com.fincrimegraph.platform.service.CaseWorkspaceService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
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
    private final SecurityAuditService auditService;

    public CaseWorkspaceController(
            CaseWorkspaceService workspaceService,
            SecurityAuditService auditService
    ) {
        this.workspaceService =
                workspaceService;

        this.auditService =
                auditService;
    }

    @GetMapping("/{caseId}")
    public CaseWorkspaceService.CaseWorkspaceView
    workspace(
            @PathVariable
            UUID caseId
    ) {
        return workspaceService
                .workspace(caseId);
    }

    @PostMapping("/{caseId}/notes")
    public CaseWorkspaceService.CaseWorkspaceView
    addNote(
            @PathVariable
            UUID caseId,

            @RequestParam
            String body,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .addNote(
                                caseId,
                                actorOf(authentication),
                                body
                        );

        auditService.record(
                authentication.getName(),
                "CASE_NOTE_ADD",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Analyst note added."
        );

        return result;
    }

    @PostMapping("/{caseId}/assign")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    assign(
            @PathVariable
            UUID caseId,

            @RequestParam
            String assignee,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .assign(
                                caseId,
                                assignee,
                                actorOf(authentication)
                        );

        auditService.record(
                authentication.getName(),
                "CASE_ASSIGN",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Case assigned to "
                        + assignee
                        + "."
        );

        return result;
    }

    @PostMapping("/{caseId}/unassign")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    unassign(
            @PathVariable
            UUID caseId,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .unassign(
                                caseId,
                                actorOf(authentication)
                        );

        auditService.record(
                authentication.getName(),
                "CASE_UNASSIGN",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Case unassigned."
        );

        return result;
    }

    @PostMapping(
            "/{caseId}/evidence/alerts/{alertId}"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    attachAlert(
            @PathVariable
            UUID caseId,

            @PathVariable
            UUID alertId,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .attachAlert(
                                caseId,
                                alertId,
                                actorOf(authentication)
                        );

        auditService.record(
                authentication.getName(),
                "CASE_EVIDENCE_ALERT",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Alert evidence attached or already present."
        );

        return result;
    }

    @PostMapping(
            "/{caseId}/evidence/transactions/{reference}"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    attachTransaction(
            @PathVariable
            UUID caseId,

            @PathVariable
            String reference,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .attachTransaction(
                                caseId,
                                reference,
                                actorOf(authentication)
                        );

        auditService.record(
                authentication.getName(),
                "CASE_EVIDENCE_TRANSACTION",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Transaction evidence "
                        + reference
                        + " attached or already present."
        );

        return result;
    }

    @PostMapping(
            "/{caseId}/evidence/graph/circular-flows"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    attachCircularFlows(
            @PathVariable
            UUID caseId,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .attachCircularGraph(
                                caseId,
                                actorOf(authentication)
                        );

        auditService.record(
                authentication.getName(),
                "CASE_EVIDENCE_GRAPH",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Circular-flow graph evidence attached or already present."
        );

        return result;
    }

    @PostMapping("/{caseId}/resolve")
    @PreAuthorize(
            "hasAnyRole('SENIOR_ANALYST','ADMIN')"
    )
    public CaseWorkspaceService.CaseWorkspaceView
    resolve(
            @PathVariable
            UUID caseId,

            @RequestParam
            String disposition,

            @RequestParam
            String summary,

            Authentication authentication
    ) {
        var result =
                workspaceService
                        .resolve(
                                caseId,
                                disposition,
                                summary,
                                actorOf(authentication)
                        );

        auditService.record(
                authentication.getName(),
                "CASE_RESOLVE",
                "INVESTIGATION_CASE",
                caseId.toString(),
                "SUCCESS",
                "Case resolved as "
                        + disposition
                        + "."
        );

        return result;
    }

    /**
     * Identity recorded on notes, assignments, evidence and the case
     * timeline. It always comes from the verified JWT, never from a
     * request parameter, so a caller cannot attribute an action to
     * somebody else.
     */
    private static String actorOf(
            Authentication authentication
    ) {
        String username =
                authentication.getName();

        String actor =
                username;

        if (
                authentication
                        instanceof JwtAuthenticationToken token
        ) {
            String displayName =
                    token
                            .getToken()
                            .getClaimAsString("name");

            if (
                    displayName != null
                            && !displayName.isBlank()
                            && !displayName.equals(username)
            ) {
                actor =
                        displayName.trim()
                                + " ("
                                + username
                                + ")";
            }
        }

        return actor.length() > 160
                ? actor.substring(0, 160)
                : actor;
    }

    @ResponseStatus(
            HttpStatus.BAD_REQUEST
    )
    @ExceptionHandler(
            IllegalArgumentException.class
    )
    public Map<String, String>
    invalidRequest(
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
