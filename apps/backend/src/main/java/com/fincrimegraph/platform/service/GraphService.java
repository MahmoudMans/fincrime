package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AccountEntity;
import com.fincrimegraph.platform.domain.CustomerEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class GraphService {

    private final Driver driver;

    public GraphService(Driver driver) {
        this.driver = driver;
    }

    public void synchronize(
            List<CustomerEntity> customers,
            List<AccountEntity> accounts,
            List<TransactionEntity> transactions
    ) {
        try (Session session = driver.session()) {

            session.executeWrite(tx -> {
                tx.run(
                        """
                        MATCH (n)
                        WHERE n:Customer OR n:Account
                        DETACH DELETE n
                        """
                ).consume();

                return null;
            });

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

            for (CustomerEntity customer : customers) {
                session.executeWrite(tx -> {
                    tx.run(
                            """
                            MERGE (c:Customer {id: $id})
                            SET c.externalId = $externalId,
                                c.name = $name,
                                c.countryCode = $countryCode,
                                c.riskTier = $riskTier
                            """,
                            Values.parameters(
                                    "id",
                                    customer.getId().toString(),
                                    "externalId",
                                    customer.getExternalId(),
                                    "name",
                                    customer.getFullName(),
                                    "countryCode",
                                    customer.getCountryCode(),
                                    "riskTier",
                                    customer.getRiskTier().name()
                            )
                    ).consume();

                    return null;
                });
            }

            for (AccountEntity account : accounts) {
                session.executeWrite(tx -> {
                    tx.run(
                            """
                            MATCH (c:Customer {id: $customerId})
                            MERGE (a:Account {id: $id})
                            SET a.accountNumber = $accountNumber,
                                a.type = $type,
                                a.currency = $currency,
                                a.status = $status,
                                a.balance = $balance,
                                a.riskTier = $riskTier,
                                a.ownerName = $ownerName,
                                a.countryCode = $countryCode
                            MERGE (c)-[:OWNS]->(a)
                            """,
                            Values.parameters(
                                    "customerId",
                                    account.getCustomer().getId().toString(),
                                    "id",
                                    account.getId().toString(),
                                    "accountNumber",
                                    account.getAccountNumber(),
                                    "type",
                                    account.getAccountType().name(),
                                    "currency",
                                    account.getCurrency(),
                                    "status",
                                    account.getStatus().name(),
                                    "balance",
                                    account.getBalance().doubleValue(),
                                    "riskTier",
                                    account.getCustomer().getRiskTier().name(),
                                    "ownerName",
                                    account.getCustomer().getFullName(),
                                    "countryCode",
                                    account.getCustomer().getCountryCode()
                            )
                    ).consume();

                    return null;
                });
            }

            for (TransactionEntity transaction : transactions) {
                session.executeWrite(tx -> {
                    tx.run(
                            """
                            MATCH (source:Account {id: $sourceId})
                            MATCH (destination:Account {id: $destinationId})
                            CREATE (source)-[:TRANSFERRED_TO {
                                id: $id,
                                reference: $reference,
                                amount: $amount,
                                currency: $currency,
                                occurredAt: $occurredAt,
                                channel: $channel,
                                destinationCountry: $destinationCountry,
                                status: $status
                            }]->(destination)
                            """,
                            Values.parameters(
                                    "sourceId",
                                    transaction
                                            .getSourceAccount()
                                            .getId()
                                            .toString(),
                                    "destinationId",
                                    transaction
                                            .getDestinationAccount()
                                            .getId()
                                            .toString(),
                                    "id",
                                    transaction.getId().toString(),
                                    "reference",
                                    transaction.getReference(),
                                    "amount",
                                    transaction.getAmount().doubleValue(),
                                    "currency",
                                    transaction.getCurrency(),
                                    "occurredAt",
                                    transaction.getOccurredAt().toString(),
                                    "channel",
                                    transaction.getChannel().name(),
                                    "destinationCountry",
                                    transaction.getDestinationCountry(),
                                    "status",
                                    transaction.getStatus().name()
                            )
                    ).consume();

                    return null;
                });
            }
        }
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
