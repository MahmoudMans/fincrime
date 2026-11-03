package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GraphService {

    private final Driver driver;

    public GraphService(Driver driver) {
        this.driver = driver;
    }

    private static final int BATCH_SIZE = 500;

    /**
     * Rebuilds the investigation graph from the relational data.
     *
     * Schema statements run first in their own transaction because
     * Neo4j does not allow schema changes and data writes in the
     * same transaction. The wipe and the rebuild then run in ONE
     * write transaction: readers never see an empty or half-built
     * graph, and any failure rolls back to the previous graph
     * instead of leaving it partly deleted. Rows are written with
     * UNWIND batches instead of one transaction per node or edge.
     */
    public void synchronize(
            List<CustomerEntity> customers,
            List<AccountEntity> accounts,
            List<TransactionEntity> transactions
    ) {
        List<Map<String, Object>> customerRows =
                new ArrayList<>(customers.size());

        for (CustomerEntity customer : customers) {
            Map<String, Object> row =
                    new HashMap<>();

            row.put("id", customer.getId().toString());
            row.put("externalId", customer.getExternalId());
            row.put("name", customer.getFullName());
            row.put("countryCode", customer.getCountryCode());
            row.put("riskTier", customer.getRiskTier().name());

            customerRows.add(row);
        }

        List<Map<String, Object>> accountRows =
                new ArrayList<>(accounts.size());

        for (AccountEntity account : accounts) {
            Map<String, Object> row =
                    new HashMap<>();

            row.put(
                    "customerId",
                    account.getCustomer().getId().toString()
            );
            row.put("id", account.getId().toString());
            row.put("accountNumber", account.getAccountNumber());
            row.put("type", account.getAccountType().name());
            row.put("currency", account.getCurrency());
            row.put("status", account.getStatus().name());
            row.put("balance", account.getBalance().doubleValue());
            row.put(
                    "riskTier",
                    account.getCustomer().getRiskTier().name()
            );
            row.put(
                    "ownerName",
                    account.getCustomer().getFullName()
            );
            row.put(
                    "countryCode",
                    account.getCustomer().getCountryCode()
            );

            accountRows.add(row);
        }

        List<Map<String, Object>> transactionRows =
                new ArrayList<>(transactions.size());

        for (TransactionEntity transaction : transactions) {
            Map<String, Object> row =
                    new HashMap<>();

            row.put(
                    "sourceId",
                    transaction.getSourceAccount().getId().toString()
            );
            row.put(
                    "destinationId",
                    transaction.getDestinationAccount().getId().toString()
            );
            row.put("id", transaction.getId().toString());
            row.put("reference", transaction.getReference());
            row.put("amount", transaction.getAmount().doubleValue());
            row.put("currency", transaction.getCurrency());
            row.put(
                    "occurredAt",
                    transaction.getOccurredAt().toString()
            );
            row.put("channel", transaction.getChannel().name());
            row.put(
                    "destinationCountry",
                    transaction.getDestinationCountry()
            );
            row.put("status", transaction.getStatus().name());

            transactionRows.add(row);
        }

        try (Session session = driver.session()) {

            session.executeWrite(tx -> {
                tx.run(
                        """
                        CREATE CONSTRAINT fincrime_customer_id
                        IF NOT EXISTS
                        FOR (c:Customer)
                        REQUIRE c.id IS UNIQUE
                        """
                ).consume();

                tx.run(
                        """
                        CREATE CONSTRAINT fincrime_account_id
                        IF NOT EXISTS
                        FOR (a:Account)
                        REQUIRE a.id IS UNIQUE
                        """
                ).consume();

                return null;
            });

            session.executeWrite(tx -> {
                tx.run(
                        """
                        MATCH (n)
                        WHERE n:Customer OR n:Account
                        DETACH DELETE n
                        """
                ).consume();

                for (
                        List<Map<String, Object>> batch
                        : partition(customerRows)
                ) {
                    tx.run(
                            """
                            UNWIND $rows AS row
                            MERGE (c:Customer {id: row.id})
                            SET c.externalId = row.externalId,
                                c.name = row.name,
                                c.countryCode = row.countryCode,
                                c.riskTier = row.riskTier
                            """,
                            Map.of("rows", batch)
                    ).consume();
                }

                for (
                        List<Map<String, Object>> batch
                        : partition(accountRows)
                ) {
                    tx.run(
                            """
                            UNWIND $rows AS row
                            MATCH (c:Customer {id: row.customerId})
                            MERGE (a:Account {id: row.id})
                            SET a.accountNumber = row.accountNumber,
                                a.type = row.type,
                                a.currency = row.currency,
                                a.status = row.status,
                                a.balance = row.balance,
                                a.riskTier = row.riskTier,
                                a.ownerName = row.ownerName,
                                a.countryCode = row.countryCode
                            MERGE (c)-[:OWNS]->(a)
                            """,
                            Map.of("rows", batch)
                    ).consume();
                }

                for (
                        List<Map<String, Object>> batch
                        : partition(transactionRows)
                ) {
                    tx.run(
                            """
                            UNWIND $rows AS row
                            MATCH (source:Account {id: row.sourceId})
                            MATCH (destination:Account {id: row.destinationId})
                            CREATE (source)-[:TRANSFERRED_TO {
                                id: row.id,
                                reference: row.reference,
                                amount: row.amount,
                                currency: row.currency,
                                occurredAt: row.occurredAt,
                                channel: row.channel,
                                destinationCountry: row.destinationCountry,
                                status: row.status
                            }]->(destination)
                            """,
                            Map.of("rows", batch)
                    ).consume();
                }

                return null;
            });
        }
    }

    private static List<List<Map<String, Object>>> partition(
            List<Map<String, Object>> rows
    ) {
        List<List<Map<String, Object>>> batches =
                new ArrayList<>();

        for (
                int start = 0;
                start < rows.size();
                start += BATCH_SIZE
        ) {
            batches.add(
                    rows.subList(
                            start,
                            Math.min(
                                    start + BATCH_SIZE,
                                    rows.size()
                            )
                    )
            );
        }

        return batches;
    }

    public GraphNetwork getNetwork() {
        try (Session session = driver.session()) {

            List<GraphNode> nodes = new ArrayList<>();

            nodes.addAll(
                    session.executeRead(tx ->
                            tx.run(
                                    """
                                    MATCH (c:Customer)
                                    RETURN
                                        c.id AS id,
                                        c.name AS label,
                                        c.countryCode AS countryCode,
                                        c.riskTier AS risk
                                    ORDER BY c.name
                                    """
                            ).list(this::customerNode)
                    )
            );

            nodes.addAll(
                    session.executeRead(tx ->
                            tx.run(
                                    """
                                    MATCH (c:Customer)-[:OWNS]->(a:Account)
                                    RETURN
                                        a.id AS id,
                                        a.accountNumber AS label,
                                        a.currency AS currency,
                                        a.status AS status,
                                        c.riskTier AS risk,
                                        c.name AS owner
                                    ORDER BY a.accountNumber
                                    """
                            ).list(this::accountNode)
                    )
            );

            List<GraphEdge> edges = new ArrayList<>();

            edges.addAll(
                    session.executeRead(tx ->
                            tx.run(
                                    """
                                    MATCH (c:Customer)-[:OWNS]->(a:Account)
                                    RETURN
                                        c.id AS source,
                                        a.id AS target
                                    """
                            ).list(record ->
                                    new GraphEdge(
                                            "owns:"
                                                    + record
                                                        .get("source")
                                                        .asString()
                                                    + ":"
                                                    + record
                                                        .get("target")
                                                        .asString(),
                                            "customer:"
                                                    + record
                                                        .get("source")
                                                        .asString(),
                                            "account:"
                                                    + record
                                                        .get("target")
                                                        .asString(),
                                            "OWNS",
                                            "owns",
                                            null,
                                            null
                                    )
                            )
                    )
            );

            edges.addAll(
                    session.executeRead(tx ->
                            tx.run(
                                    """
                                    MATCH (source:Account)
                                          -[transfer:TRANSFERRED_TO]->
                                          (destination:Account)
                                    RETURN
                                        transfer.id AS id,
                                        source.id AS source,
                                        destination.id AS target,
                                        transfer.reference AS reference,
                                        transfer.amount AS amount,
                                        transfer.currency AS currency
                                    ORDER BY transfer.amount DESC
                                    """
                            ).list(record ->
                                    new GraphEdge(
                                            "transfer:"
                                                    + record
                                                        .get("id")
                                                        .asString(),
                                            "account:"
                                                    + record
                                                        .get("source")
                                                        .asString(),
                                            "account:"
                                                    + record
                                                        .get("target")
                                                        .asString(),
                                            "TRANSFER",
                                            record
                                                    .get("reference")
                                                    .asString(),
                                            BigDecimal.valueOf(
                                                    record
                                                        .get("amount")
                                                        .asDouble()
                                            ),
                                            record
                                                    .get("currency")
                                                    .asString()
                                    )
                            )
                    )
            );

            return new GraphNetwork(
                    List.copyOf(nodes),
                    List.copyOf(edges)
            );
        }
    }

    private GraphNode customerNode(Record record) {
        return new GraphNode(
                "customer:" + record.get("id").asString(),
                record.get("label").asString(),
                "CUSTOMER",
                record.get("risk").asString(),
                "Customer · "
                        + record.get("countryCode").asString()
        );
    }

    private GraphNode accountNode(Record record) {
        return new GraphNode(
                "account:" + record.get("id").asString(),
                record.get("label").asString(),
                "ACCOUNT",
                record.get("risk").asString(),
                record.get("owner").asString()
                        + " · "
                        + record.get("currency").asString()
                        + " · "
                        + record.get("status").asString()
        );
    }

    public record GraphNetwork(
            List<GraphNode> nodes,
            List<GraphEdge> edges
    ) {
    }

    public record GraphNode(
            String id,
            String label,
            String kind,
            String risk,
            String subtitle
    ) {
    }

    public record GraphEdge(
            String id,
            String source,
            String target,
            String kind,
            String label,
            BigDecimal amount,
            String currency
    ) {
    }
}
