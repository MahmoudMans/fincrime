package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.GraphInvestigationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/graph-investigation")
public class GraphInvestigationController {

    private final GraphInvestigationService investigationService;

    public GraphInvestigationController(
            GraphInvestigationService investigationService
    ) {
        this.investigationService =
                investigationService;
    }

    @GetMapping("/summary")
    public GraphInvestigationService.InvestigationSummary
    summary() {
        return investigationService.summary();
    }

    @GetMapping("/accounts")
    public List<
            GraphInvestigationService.AccountOption
            > accounts() {
        return investigationService.accountOptions();
    }

    @GetMapping("/path")
    public GraphInvestigationService.InvestigationGraph
    path(
            @RequestParam
            String source,

            @RequestParam
            String target,

            @RequestParam(defaultValue = "4")
            int maxHops
    ) {
        return investigationService.shortestPath(
                source,
                target,
                maxHops
        );
    }

    @GetMapping("/neighborhood")
    public GraphInvestigationService.InvestigationGraph
    neighborhood(
            @RequestParam
            String account,

            @RequestParam(defaultValue = "2")
            int depth
    ) {
        return investigationService.neighborhood(
                account,
                depth
        );
    }

    @GetMapping("/cycles")
    public GraphInvestigationService.InvestigationGraph
    cycles() {
        return investigationService.circularFlows();
    }

    @ResponseStatus(HttpStatus.BAD_REQUEST)
    @ExceptionHandler(IllegalArgumentException.class)
    public Map<String, String> invalidRequest(
            IllegalArgumentException exception
    ) {
        return Map.of(
                "error",
                "INVALID_GRAPH_REQUEST",
                "message",
                exception.getMessage()
        );
    }
}
