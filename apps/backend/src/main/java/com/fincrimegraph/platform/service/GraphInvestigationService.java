package com.fincrimegraph.platform.service;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class GraphInvestigationService {

    private static final int MIN_PATH_HOPS = 1;
    private static final int MAX_PATH_HOPS = 5;

    private static final int MIN_NEIGHBORHOOD_DEPTH = 1;
    private static final int MAX_NEIGHBORHOOD_DEPTH = 4;

    private final Driver driver;

    public GraphInvestigationService(
            Driver driver
    ) {
        this.driver = driver;
    }

    public InvestigationSummary summary() {
        try (Session session = driver.session()) {

            long accounts =
                    count(
                            session,
                            """
                            MATCH (a:Account)
                            RETURN count(a) AS count
                            """
                    );

            long transfers =
                    count(
                            session,
                            """
                            MATCH ()-[r:TRANSFERRED_TO]->()
                            RETURN count(r) AS count
                            """
                    );

            long highRiskAccounts =
                    count(
                            session,
                            """
                            MATCH (a:Account)
                            WHERE a.riskTier = 'HIGH'
                            RETURN count(a) AS count
                            """
                    );

            long crossBorderTransfers =
                    count(
                            session,
                            """
                            MATCH
                              (sourceCustomer:Customer)-[:OWNS]->
                              (source:Account)-[r:TRANSFERRED_TO]->
                              (destination:Account)<-[:OWNS]-
                              (destinationCustomer:Customer)
                            WHERE sourceCustomer.countryCode
                                  <> destinationCustomer.countryCode
                            RETURN count(r) AS count
                            """
                    );

            long circularFlows =
                    count(
                            session,
                            """
                            MATCH
                              (a:Account)-[:TRANSFERRED_TO]->
                              (b:Account)-[:TRANSFERRED_TO]->
                              (c:Account)-[:TRANSFERRED_TO]->
                              (a)
                            WHERE a.id < b.id
                              AND a.id < c.id
                              AND b.id <> c.id
                            RETURN count(*) AS count
                            """
                    );

            return new InvestigationSummary(
                    accounts,
                    transfers,
                    highRiskAccounts,
                    crossBorderTransfers,
                    circularFlows
            );
        }
    }

    public List<AccountOption> accountOptions() {
        try (Session session = driver.session()) {

            return session.executeRead(
                    tx ->
                            tx.run(
                                    """
                                    MATCH
                                      (customer:Customer)-[:OWNS]->
                                      (account:Account)
                                    RETURN
                                      account.accountNumber AS accountNumber,
                                      customer.name AS ownerName,
                                      customer.countryCode AS countryCode,
                                      customer.riskTier AS riskTier,
                                      account.status AS status
                                    ORDER BY account.accountNumber
                                    """
                            )
                                    .list(
                                            record ->
                                                    new AccountOption(
                                                            record
                                                                    .get(
                                                                            "accountNumber"
                                                                    )
                                                                    .asString(),
                                                            record
                                                                    .get(
                                                                            "ownerName"
                                                                    )
                                                                    .asString(),
                                                            record
                                                                    .get(
                                                                            "countryCode"
                                                                    )
                                                                    .asString(),
                                                            record
                                                                    .get(
                                                                            "riskTier"
                                                                    )
                                                                    .asString(),
                                                            record
                                                                    .get(
                                                                            "status"
                                                                    )
                                                                    .asString()
                                                    )
                                    )
            );
        }
    }

    public InvestigationGraph shortestPath(
            String sourceAccount,
            String targetAccount,
            int maxHops
    ) {
        validateRange(
                "maxHops",
                maxHops,
                MIN_PATH_HOPS,
                MAX_PATH_HOPS
        );

        String source =
                normalizeAccountNumber(
                        sourceAccount,
                        "source"
                );

        String target =
                normalizeAccountNumber(
                        targetAccount,
                        "target"
                );

        if (source.equals(target)) {
            throw new IllegalArgumentException(
                    "Source and target accounts must be different."
            );
        }

        String cypher = """
                MATCH p = shortestPath(
                    (source:Account {accountNumber: $source})
                    -[:TRANSFERRED_TO*1..%d]->
                    (target:Account {accountNumber: $target})
                )
                WITH
                    p,
                    nodes(p) AS pathNodes,
                    relationships(p) AS pathRelationships

                UNWIND pathRelationships AS relationship

                MATCH
                    (from:Account)-[relationship:TRANSFERRED_TO]->
                    (to:Account)

                WITH
                    p,
                    pathNodes,
                    collect({
                        id: relationship.id,
                        source: from.id,
                        target: to.id,
                        reference: relationship.reference,
                        amount: relationship.amount,
                        currency: relationship.currency
                    }) AS edgeMaps

                RETURN
                    [
                        node IN pathNodes |
                        {
                            id: node.id,
                            accountNumber: node.accountNumber,
                            riskTier: node.riskTier,
                            ownerName: node.ownerName,
                            countryCode: node.countryCode,
                            status: node.status
                        }
                    ] AS nodes,
                    edgeMaps AS edges,
                    length(p) AS hops
                """.formatted(maxHops);

        try (Session session = driver.session()) {

            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "source",
                                                source,
                                                "target",
                                                target
                                        )
                                );

                        if (!result.hasNext()) {
                            return InvestigationGraph.empty(
                                    "PATH",
                                    "No directed path found",
                                    source
                                            + " → "
                                            + target
                                            + " within "
                                            + maxHops
                                            + " hops."
                            );
                        }

                        Record record =
                                result.next();

                        return graphFromRecord(
                                record,
                                "PATH",
                                "Directed money-flow path",
                                source
                                        + " → "
                                        + target,
                                true,
                                record
                                        .get("hops")
                                        .asInt(),
                                0
                        );
                    }
            );
        }
    }

    public InvestigationGraph neighborhood(
            String accountNumber,
            int depth
    ) {
        validateRange(
                "depth",
                depth,
                MIN_NEIGHBORHOOD_DEPTH,
                MAX_NEIGHBORHOOD_DEPTH
        );

        String account =
                normalizeAccountNumber(
                        accountNumber,
                        "account"
                );

        String cypher = """
                MATCH
                    (center:Account {accountNumber: $account})

                OPTIONAL MATCH path =
                    (center)-[:TRANSFERRED_TO*1..%d]-
                    (other:Account)

                WITH
                    center,
                    [
                        node IN collect(DISTINCT other)
                        WHERE node IS NOT NULL
                    ] AS otherNodes

                WITH
                    [center] + otherNodes AS candidateNodes

                UNWIND candidateNodes AS candidate

                WITH
                    collect(DISTINCT candidate) AS nodes

                UNWIND nodes AS from

                OPTIONAL MATCH
                    (from)-[relationship:TRANSFERRED_TO]->
                    (to:Account)

                WHERE to IN nodes

                WITH
                    nodes,
                    collect(
                        DISTINCT CASE
                            WHEN relationship IS NULL
                            THEN null
                            ELSE {
                                id: relationship.id,
                                source: from.id,
                                target: to.id,
                                reference: relationship.reference,
                                amount: relationship.amount,
                                currency: relationship.currency
                            }
                        END
                    ) AS maybeEdges

                RETURN
                    [
                        node IN nodes |
                        {
                            id: node.id,
                            accountNumber: node.accountNumber,
                            riskTier: node.riskTier,
                            ownerName: node.ownerName,
                            countryCode: node.countryCode,
                            status: node.status
                        }
                    ] AS nodes,
                    [
                        edge IN maybeEdges
                        WHERE edge IS NOT NULL
                    ] AS edges
                """.formatted(depth);

        try (Session session = driver.session()) {

            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "account",
                                                account
                                        )
                                );

                        if (!result.hasNext()) {
                            return InvestigationGraph.empty(
                                    "NEIGHBORHOOD",
                                    "Account not found",
                                    account
                            );
                        }

                        return graphFromRecord(
                                result.next(),
                                "NEIGHBORHOOD",
                                "Account neighborhood",
                                account
                                        + " · depth "
                                        + depth,
                                true,
                                0,
                                0
                        );
                    }
            );
        }
    }

    public InvestigationGraph circularFlows() {

        String cypher = """
                MATCH path =
                    (a:Account)-[:TRANSFERRED_TO]->
                    (b:Account)-[:TRANSFERRED_TO]->
                    (c:Account)-[:TRANSFERRED_TO]->
                    (a)

                WHERE a.id < b.id
                  AND a.id < c.id
                  AND b.id <> c.id

                WITH
                    collect(path) AS paths

                WITH
                    paths,
                    size(paths) AS cycleCount

                UNWIND paths AS currentPath

                UNWIND nodes(currentPath) AS node

                WITH
                    paths,
                    cycleCount,
                    collect(DISTINCT node) AS nodes

                UNWIND paths AS edgePath

                UNWIND relationships(edgePath) AS relationship

                MATCH
                    (from:Account)-[relationship:TRANSFERRED_TO]->
                    (to:Account)

                WITH
                    cycleCount,
                    nodes,
                    collect(
                        DISTINCT {
                            id: relationship.id,
                            source: from.id,
                            target: to.id,
                            reference: relationship.reference,
                            amount: relationship.amount,
                            currency: relationship.currency
                        }
                    ) AS edges

                RETURN
                    cycleCount,
                    [
                        node IN nodes |
                        {
                            id: node.id,
                            accountNumber: node.accountNumber,
                            riskTier: node.riskTier,
                            ownerName: node.ownerName,
                            countryCode: node.countryCode,
                            status: node.status
                        }
                    ] AS nodes,
                    edges
                """;

        try (Session session = driver.session()) {

            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(cypher);

                        if (!result.hasNext()) {
                            return InvestigationGraph.empty(
                                    "CYCLES",
                                    "No circular flows detected",
                                    "No three-hop circular money flows are present."
                            );
                        }

                        Record record =
                                result.next();

                        int cycleCount =
                                record
                                        .get("cycleCount")
                                        .asInt();

                        return graphFromRecord(
                                record,
                                "CYCLES",
                                "Circular money flows",
                                cycleCount
                                        + " circular transfer pattern"
                                        + (cycleCount == 1 ? "" : "s")
                                        + " detected.",
                                cycleCount > 0,
                                0,
                                cycleCount
                        );
                    }
            );
        }
    }

    private long count(
            Session session,
            String cypher
    ) {
        return session.executeRead(
                tx ->
                        tx.run(cypher)
                                .single()
                                .get("count")
                                .asLong()
        );
    }

    private InvestigationGraph graphFromRecord(
            Record record,
            String mode,
            String headline,
            String description,
            boolean found,
            int hopCount,
            int cycleCount
    ) {
        List<Map<String, Object>> nodeMaps =
                record
                        .get("nodes")
                        .asList(
                                value ->
                                        value.asMap()
                        );

        List<Map<String, Object>> edgeMaps =
                record
                        .get("edges")
                        .asList(
                                value ->
                                        value.asMap()
                        );

        Map<String, InvestigationNode> nodes =
                new LinkedHashMap<>();

        for (
                Map<String, Object> nodeMap
                        : nodeMaps
        ) {
            String id =
                    text(
                            nodeMap.get("id")
                    );

            if (id.isBlank()) {
                continue;
            }

            nodes.put(
                    id,
                    new InvestigationNode(
                            "account:" + id,
                            text(
                                    nodeMap.get(
                                            "accountNumber"
                                    )
                            ),
                            textOrDefault(
                                    nodeMap.get(
                                            "riskTier"
                                    ),
                                    "LOW"
                            ),
                            textOrDefault(
                                    nodeMap.get(
                                            "ownerName"
                                    ),
                                    "Unknown owner"
                            ),
                            textOrDefault(
                                    nodeMap.get(
                                            "countryCode"
                                    ),
                                    "--"
                            ),
                            textOrDefault(
                                    nodeMap.get(
                                            "status"
                                    ),
                                    "UNKNOWN"
                            )
                    )
            );
        }

        Map<String, InvestigationEdge> edges =
                new LinkedHashMap<>();

        for (
                Map<String, Object> edgeMap
                        : edgeMaps
        ) {
            String id =
                    text(
                            edgeMap.get("id")
                    );

            String source =
                    text(
                            edgeMap.get("source")
                    );

            String target =
                    text(
                            edgeMap.get("target")
                    );

            if (
                    id.isBlank()
                            || source.isBlank()
                            || target.isBlank()
            ) {
                continue;
            }

            edges.put(
                    id,
                    new InvestigationEdge(
                            "transfer:" + id,
                            "account:" + source,
                            "account:" + target,
                            textOrDefault(
                                    edgeMap.get(
                                            "reference"
                                    ),
                                    "TRANSFER"
                            ),
                            decimal(
                                    edgeMap.get(
                                            "amount"
                                    )
                            ),
                            textOrDefault(
                                    edgeMap.get(
                                            "currency"
                                    ),
                                    ""
                            )
                    )
            );
        }

        return new InvestigationGraph(
                mode,
                headline,
                description,
                found,
                hopCount,
                cycleCount,
                List.copyOf(
                        nodes.values()
                ),
                List.copyOf(
                        edges.values()
                )
        );
    }

    private String normalizeAccountNumber(
            String value,
            String field
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    field
                            + " account number is required."
            );
        }

        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private void validateRange(
            String field,
            int value,
            int minimum,
            int maximum
    ) {
        if (
                value < minimum
                        || value > maximum
        ) {
            throw new IllegalArgumentException(
                    field
                            + " must be between "
                            + minimum
                            + " and "
                            + maximum
                            + "."
            );
        }
    }

    private String text(
            Object value
    ) {
        return value == null
                ? ""
                : value.toString();
    }

    private String textOrDefault(
            Object value,
            String fallback
    ) {
        String result =
                text(value);

        return result.isBlank()
                ? fallback
                : result;
    }

    private BigDecimal decimal(
            Object value
    ) {
        if (value == null) {
            return BigDecimal.ZERO;
        }

        if (value instanceof Number number) {
            return BigDecimal.valueOf(
                    number.doubleValue()
            );
        }

        return new BigDecimal(
                value.toString()
        );
    }

    public record InvestigationSummary(
            long accounts,
            long transferRelationships,
            long highRiskAccounts,
            long crossBorderTransfers,
            long circularFlows
    ) {
    }

    public record AccountOption(
            String accountNumber,
            String ownerName,
            String countryCode,
            String riskTier,
            String status
    ) {
    }

    public record InvestigationNode(
            String id,
            String accountNumber,
            String riskTier,
            String ownerName,
            String countryCode,
            String status
    ) {
    }

    public record InvestigationEdge(
            String id,
            String source,
            String target,
            String reference,
            BigDecimal amount,
            String currency
    ) {
    }

    public record InvestigationGraph(
            String mode,
            String headline,
            String description,
            boolean found,
            int hopCount,
            int cycleCount,
            List<InvestigationNode> nodes,
            List<InvestigationEdge> edges
    ) {

        public static InvestigationGraph empty(
                String mode,
                String headline,
                String description
        ) {
            return new InvestigationGraph(
                    mode,
                    headline,
                    description,
                    false,
                    0,
                    0,
                    List.of(),
                    List.of()
            );
        }
    }
}
