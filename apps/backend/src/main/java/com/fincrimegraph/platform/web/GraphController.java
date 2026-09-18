package com.fincrimegraph.platform.web;

import com.fincrimegraph.platform.service.GraphService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/graph")
public class GraphController {

    private final GraphService graphService;

    public GraphController(GraphService graphService) {
        this.graphService = graphService;
    }

    @GetMapping("/network")
    public GraphService.GraphNetwork network() {
        return graphService.getNetwork();
    }
}
