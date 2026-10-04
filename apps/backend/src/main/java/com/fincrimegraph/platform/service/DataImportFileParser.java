package com.fincrimegraph.platform.service;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Component
public class DataImportFileParser {

    private final ObjectMapper objectMapper;

    public DataImportFileParser(
            ObjectMapper objectMapper
    ) {
        this.objectMapper = objectMapper;
    }

    public ParsedInput parse(
            String fileName,
            byte[] bytes
    ) {
        String normalizedName =
                fileName == null
                        ? ""
                        : fileName
                        .toLowerCase(Locale.ROOT);

        String content =
                new String(
                        bytes,
                        StandardCharsets.UTF_8
                );

        if (normalizedName.endsWith(".json")
                || looksLikeJson(content)) {
            return parseJson(content);
        }

        if (normalizedName.endsWith(".csv")) {
            return parseCsv(content);
        }

        throw badRequest(
                "Only CSV and JSON files are supported."
        );
    }

    private boolean looksLikeJson(
            String content
    ) {
        String value = stripBom(content).trim();

        return value.startsWith("[")
                || value.startsWith("{");
    }

    private ParsedInput parseJson(
            String content
    ) {
        try {
            JsonNode root =
                    objectMapper.readTree(
                            stripBom(content)
                    );

            JsonNode rowsNode =
                    root.isArray()
                            ? root
                            : root.get("rows");

            if (
                    rowsNode == null
                            || !rowsNode.isArray()
            ) {
                throw badRequest(
                        "JSON must be an array of objects "
                                + "or an object containing a rows array."
                );
            }

            Set<String> headers =
                    new LinkedHashSet<>();

            List<ParsedRow> rows =
                    new ArrayList<>();

            int rowNumber = 1;

            for (JsonNode node : rowsNode) {

                if (!node.isObject()) {
                    throw badRequest(
                            "Every JSON row must be an object."
                    );
                }

                Map<String, String> values =
                        new LinkedHashMap<>();

                node.properties().forEach(
                        entry -> {
                            String key =
                                    normalizeHeader(
                                            entry.getKey()
                                    );

                            JsonNode value =
                                    entry.getValue();

                            headers.add(key);

                            values.put(
                                    key,
                                    value == null
                                            || value.isNull()
                                            ? ""
                                            : value.isValueNode()
                                            ? value.asText().trim()
                                            : value.toString()
                            );
                        }
                );

                rows.add(
                        new ParsedRow(
                                rowNumber++,
                                immutable(values)
                        )
                );
            }

            if (rows.isEmpty()) {
                throw badRequest(
                        "The JSON file does not contain any rows."
                );
            }

            return new ParsedInput(
                    "JSON",
                    List.copyOf(headers),
                    List.copyOf(rows)
            );

        } catch (ResponseStatusException exception) {
            throw exception;

        } catch (Exception exception) {
            throw badRequest(
                    "The JSON file could not be parsed."
            );
        }
    }

    private ParsedInput parseCsv(
            String content
    ) {
        List<List<String>> records =
                csvRecords(
                        stripBom(content)
                );

        if (records.size() < 2) {
            throw badRequest(
                    "The CSV file must contain a header "
                            + "and at least one data row."
            );
        }

        List<String> rawHeaders =
                records.getFirst();

        List<String> headers =
                new ArrayList<>();

        Set<String> unique =
                new LinkedHashSet<>();

        for (String raw : rawHeaders) {
            String header =
                    normalizeHeader(raw);

            if (header.isBlank()) {
                throw badRequest(
                        "CSV headers may not be blank."
                );
            }

            if (!unique.add(header)) {
                throw badRequest(
                        "Duplicate CSV header: "
                                + header
                );
            }

            headers.add(header);
        }

        List<ParsedRow> rows =
                new ArrayList<>();

        for (
                int index = 1;
                index < records.size();
                index++
        ) {
            List<String> cells =
                    records.get(index);

            boolean blank =
                    cells.stream()
                            .allMatch(
                                    value ->
                                            value == null
                                                    || value.isBlank()
                            );

            if (blank) {
                continue;
            }

            if (cells.size() != headers.size()) {
                throw badRequest(
                        "CSV row "
                                + (index + 1)
                                + " has "
                                + cells.size()
                                + " columns but "
                                + headers.size()
                                + " were expected."
                );
            }

            Map<String, String> values =
                    new LinkedHashMap<>();

            for (
                    int cellIndex = 0;
                    cellIndex < headers.size();
                    cellIndex++
            ) {
                values.put(
                        headers.get(cellIndex),
                        cells
                                .get(cellIndex)
                                .trim()
                );
            }

            rows.add(
                    new ParsedRow(
                            index + 1,
                            immutable(values)
                    )
            );
        }

        if (rows.isEmpty()) {
            throw badRequest(
                    "The CSV file contains no data rows."
            );
        }

        return new ParsedInput(
                "CSV",
                List.copyOf(headers),
                List.copyOf(rows)
        );
    }

    private List<List<String>> csvRecords(
            String source
    ) {
        List<List<String>> rows =
                new ArrayList<>();

        List<String> row =
                new ArrayList<>();

        StringBuilder field =
                new StringBuilder();

        boolean quoted = false;

        for (
                int index = 0;
                index < source.length();
                index++
        ) {
            char current =
                    source.charAt(index);

            if (quoted) {

                if (current == '"') {

                    if (
                            index + 1 < source.length()
                                    && source.charAt(
                                    index + 1
                            ) == '"'
                    ) {
                        field.append('"');
                        index++;
                    } else {
                        quoted = false;
                    }

                } else {
                    field.append(current);
                }

                continue;
            }

            if (
                    current == '"'
                            && field.length() == 0
            ) {
                quoted = true;
                continue;
            }

            if (current == ',') {
                row.add(field.toString());
                field.setLength(0);
                continue;
            }

            if (
                    current == '\n'
                            || current == '\r'
            ) {
                if (
                        current == '\r'
                                && index + 1
                                < source.length()
                                && source.charAt(
                                index + 1
                        ) == '\n'
                ) {
                    index++;
                }

                row.add(field.toString());
                field.setLength(0);

                rows.add(
                        List.copyOf(row)
                );

                row.clear();
                continue;
            }

            field.append(current);
        }

        if (quoted) {
            throw badRequest(
                    "The CSV file contains an unclosed quoted field."
            );
        }

        if (
                field.length() > 0
                        || !row.isEmpty()
        ) {
            row.add(field.toString());

            rows.add(
                    List.copyOf(row)
            );
        }

        return rows;
    }

    private String normalizeHeader(
            String value
    ) {
        String normalized =
                stripBom(
                        value == null
                                ? ""
                                : value
                )
                        .trim()
                        .toLowerCase(Locale.ROOT)
                        .replace('-', '_')
                        .replace(' ', '_');

        return normalized
                .replaceAll(
                        "[^a-z0-9_]",
                        ""
                );
    }

    private String stripBom(
            String value
    ) {
        if (
                value != null
                        && !value.isEmpty()
                        && value.charAt(0)
                        == '\uFEFF'
        ) {
            return value.substring(1);
        }

        return value == null
                ? ""
                : value;
    }

    private Map<String, String> immutable(
            Map<String, String> values
    ) {
        return Collections.unmodifiableMap(
                new LinkedHashMap<>(
                        values
                )
        );
    }

    private ResponseStatusException badRequest(
            String message
    ) {
        return new ResponseStatusException(
                BAD_REQUEST,
                message
        );
    }

    public record ParsedInput(
            String format,
            List<String> headers,
            List<ParsedRow> rows
    ) {
    }

    public record ParsedRow(
            int rowNumber,
            Map<String, String> values
    ) {
    }
}
