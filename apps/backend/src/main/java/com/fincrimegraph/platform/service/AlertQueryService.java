package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Read-only, filterable and paged access to the full alert queue.
 *
 * The dashboard overview only exposes the eight highest-scoring
 * alerts, which is not enough for a working alert queue. This service
 * lets analysts search, filter and page through every alert.
 */
@Service
public class AlertQueryService {

    static final int DEFAULT_PAGE_SIZE = 25;
    static final int MAX_PAGE_SIZE = 100;
    static final int MAX_QUERY_LENGTH = 100;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public AlertPage search(
            String status,
            String severity,
            String text,
            int page,
            int size
    ) {
        AlertEntity.AlertStatus statusFilter =
                parseStatus(status);

        AlertEntity.AlertSeverity severityFilter =
                parseSeverity(severity);

        String likePattern =
                toLikePattern(text);

        int safePage =
                Math.max(page, 0);

        int safeSize =
                normalizeSize(size);

        StringBuilder where =
                new StringBuilder(" where 1 = 1");

        Map<String, Object> parameters =
                new HashMap<>();

        if (statusFilter != null) {
            where.append(" and a.status = :status");
            parameters.put("status", statusFilter);
        }

        if (severityFilter != null) {
            where.append(" and a.severity = :severity");
            parameters.put("severity", severityFilter);
        }

        if (likePattern != null) {
            where.append(
                    " and (lower(a.title) like :text"
                            + " or lower(a.alertCode) like :text"
                            + " or lower(a.description) like :text)"
            );
            parameters.put("text", likePattern);
        }

        TypedQuery<Long> countQuery =
                entityManager.createQuery(
                        "select count(a) from AlertEntity a"
                                + where,
                        Long.class
                );

        for (
                Map.Entry<String, Object> parameter
                : parameters.entrySet()
        ) {
            countQuery.setParameter(
                    parameter.getKey(),
                    parameter.getValue()
            );
        }

        long totalItems =
                countQuery.getSingleResult();

        TypedQuery<AlertEntity> selectQuery =
                entityManager.createQuery(
                        "select a from AlertEntity a"
                                + " left join fetch a.primaryAccount"
                                + " left join fetch a.transaction"
                                + where
                                + " order by a.riskScore desc,"
                                + " a.createdAt desc,"
                                + " a.alertCode asc",
                        AlertEntity.class
                );

        for (
                Map.Entry<String, Object> parameter
                : parameters.entrySet()
        ) {
            selectQuery.setParameter(
                    parameter.getKey(),
                    parameter.getValue()
            );
        }

        selectQuery.setFirstResult(
                Math.toIntExact(
                        Math.min(
                                (long) safePage * safeSize,
                                Integer.MAX_VALUE
                        )
                )
        );
        selectQuery.setMaxResults(safeSize);

        List<AlertItem> items =
                selectQuery
                        .getResultList()
                        .stream()
                        .map(this::toItem)
                        .toList();

        int totalPages =
                (int) Math.ceil(
                        totalItems / (double) safeSize
                );

        return new AlertPage(
                items,
                safePage,
                safeSize,
                totalItems,
                totalPages,
                severityCounts(),
                statusCounts()
        );
    }

    private Map<String, Long> severityCounts() {
        return countBy(
                "severity",
                AlertEntity.AlertSeverity.class
        );
    }

    private Map<String, Long> statusCounts() {
        return countBy(
                "status",
                AlertEntity.AlertStatus.class
        );
    }

    /**
     * Global alert counts per enum value, with zeroes included so
     * the UI can always render every filter chip. The field name is
     * a constant supplied by this class, never by a caller.
     */
    private <E extends Enum<E>> Map<String, Long> countBy(
            String field,
            Class<E> type
    ) {
        Map<String, Long> result =
                new LinkedHashMap<>();

        for (E value : type.getEnumConstants()) {
            result.put(value.name(), 0L);
        }

        List<Object[]> rows =
                entityManager
                        .createQuery(
                                "select a." + field
                                        + ", count(a)"
                                        + " from AlertEntity a"
                                        + " group by a." + field,
                                Object[].class
                        )
                        .getResultList();

        for (Object[] row : rows) {
            result.put(
                    ((Enum<?>) row[0]).name(),
                    (Long) row[1]
            );
        }

        return result;
    }

    private AlertItem toItem(AlertEntity alert) {
        return new AlertItem(
                alert.getId().toString(),
                alert.getAlertCode(),
                alert.getAlertType().name(),
                alert.getSeverity().name(),
                alert.getRiskScore(),
                alert.getStatus().name(),
                alert.getTitle(),
                alert.getDescription(),
                alert.getPrimaryAccount() == null
                        ? null
                        : alert.getPrimaryAccount()
                                .getAccountNumber(),
                alert.getTransaction() == null
                        ? null
                        : alert.getTransaction()
                                .getReference(),
                alert.getCreatedAt()
        );
    }

    static AlertEntity.AlertStatus parseStatus(
            String value
    ) {
        if (isBlankOrAll(value)) {
            return null;
        }

        try {
            return AlertEntity.AlertStatus.valueOf(
                    value.trim().toUpperCase(Locale.ROOT)
            );
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "Unsupported alert status: " + value
            );
        }
    }

    static AlertEntity.AlertSeverity parseSeverity(
            String value
    ) {
        if (isBlankOrAll(value)) {
            return null;
        }

        try {
            return AlertEntity.AlertSeverity.valueOf(
                    value.trim().toUpperCase(Locale.ROOT)
            );
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "Unsupported alert severity: " + value
            );
        }
    }

    static int normalizeSize(int size) {
        if (size <= 0) {
            return DEFAULT_PAGE_SIZE;
        }

        return Math.min(size, MAX_PAGE_SIZE);
    }

    /**
     * Turns free text into a lower-cased LIKE pattern. LIKE
     * wildcards and the escape character are stripped so callers
     * cannot turn a search into a pattern scan.
     */
    static String toLikePattern(String text) {
        if (text == null) {
            return null;
        }

        String cleaned =
                text
                        .replace("%", " ")
                        .replace("_", " ")
                        .replace("\\", " ")
                        .trim()
                        .toLowerCase(Locale.ROOT);

        if (cleaned.isEmpty()) {
            return null;
        }

        if (cleaned.length() > MAX_QUERY_LENGTH) {
            cleaned =
                    cleaned.substring(0, MAX_QUERY_LENGTH);
        }

        return "%" + cleaned + "%";
    }

    private static boolean isBlankOrAll(String value) {
        return value == null
                || value.isBlank()
                || value.trim().equalsIgnoreCase("ALL");
    }

    public record AlertPage(
            List<AlertItem> items,
            int page,
            int size,
            long totalItems,
            int totalPages,
            Map<String, Long> severityCounts,
            Map<String, Long> statusCounts
    ) {
    }

    public record AlertItem(
            String id,
            String code,
            String type,
            String severity,
            int riskScore,
            String status,
            String title,
            String description,
            String accountNumber,
            String transactionReference,
            Instant createdAt
    ) {
    }
}
