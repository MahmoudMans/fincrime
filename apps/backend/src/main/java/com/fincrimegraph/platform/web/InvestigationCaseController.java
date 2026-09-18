package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.InvestigationCaseService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/cases")
public class InvestigationCaseController {

    private final InvestigationCaseService caseService;

    public InvestigationCaseController(
            InvestigationCaseService caseService
    ) {
        this.caseService = caseService;
    }

    @GetMapping
    public List<InvestigationCaseService.InvestigationCaseView>
    listCases() {
        return caseService.listCases();
    }

    @PostMapping("/from-alert/{alertId}")
    public InvestigationCaseService.InvestigationCaseView
    openFromAlert(
            @PathVariable UUID alertId
    ) {
        return caseService.openFromAlert(alertId);
    }

    @PostMapping("/{caseId}/advance")
    public InvestigationCaseService.InvestigationCaseView
    advance(
            @PathVariable UUID caseId
    ) {
        return caseService.advanceCase(caseId);
    }
}
