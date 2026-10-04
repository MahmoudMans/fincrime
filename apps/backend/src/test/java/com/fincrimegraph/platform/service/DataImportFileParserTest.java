package com.fincrimegraph.platform.service;

import tools.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

class DataImportFileParserTest {

    private final DataImportFileParser parser =
            new DataImportFileParser(
                    new ObjectMapper()
            );

    @Test
    void parsesQuotedCsvRows() {
        String csv =
                """
                external_id,full_name,country_code,risk_tier,created_at
                CUST-900,"Doe, Jane",FR,HIGH,2026-10-04T12:00:00Z
                """;

        DataImportFileParser.ParsedInput
                parsed =
                parser.parse(
                        "customers.csv",
                        csv.getBytes(
                                StandardCharsets.UTF_8
                        )
                );

        assertThat(
                parsed.format()
        ).isEqualTo("CSV");

        assertThat(
                parsed.rows()
        ).hasSize(1);

        assertThat(
                parsed.rows()
                        .getFirst()
                        .values()
                        .get("full_name")
        ).isEqualTo("Doe, Jane");
    }

    @Test
    void parsesJsonArrayRows() {
        String json =
                """
                [
                  {
                    "account_number": "ACC-900",
                    "account_type": "CHECKING",
                    "currency": "EUR",
                    "balance": 1000.50,
                    "status": "ACTIVE",
                    "customer_external_id": "CUST-900",
                    "created_at": "2026-10-04T12:00:00Z"
                  }
                ]
                """;

        DataImportFileParser.ParsedInput
                parsed =
                parser.parse(
                        "accounts.json",
                        json.getBytes(
                                StandardCharsets.UTF_8
                        )
                );

        assertThat(
                parsed.format()
        ).isEqualTo("JSON");

        assertThat(
                parsed.rows()
        ).hasSize(1);

        assertThat(
                parsed.rows()
                        .getFirst()
                        .values()
                        .get("balance")
        ).isEqualTo("1000.5");
    }
}
