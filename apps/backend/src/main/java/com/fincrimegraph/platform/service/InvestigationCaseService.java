package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.InvestigationCaseEntity;
import com.fincrimegraph.platform.repository.AlertRepository;
import com.fincrimegraph.platform.repository.InvestigationCaseRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class InvestigationCaseService {

    private final InvestigationCaseRepository caseRepository;
    private final AlertRepository alertRepository;

    public InvestigationCaseService(
            InvestigationCaseRepository caseRepository,
            AlertRepository alertRepository
    ) {
        this.caseRepository = caseRepository;
        this.alertRepository = alertRepository;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public List<InvestigationCaseView> listCases() {
        return caseRepository
                .findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(transactionManager = "transactionManager")
    public InvestigationCaseView openFromAlert(
            UUID alertId
    ) {
        return caseRepository
                .findByPrimaryAlert_Id(alertId)
                .map(this::toView)
                .orElseGet(
                        () -> createFromAlert(alertId)
                );
    }

    @Transactional(transactionManager = "transactionManager")
    public InvestigationCaseView advanceCase(
            UUID caseId
    ) {
        InvestigationCaseEntity investigationCase =
                caseRepository
                        .findById(caseId)
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Investigation case not found: "
                                                + caseId
                                )
                        );

        // A case can only be closed through the governed resolve flow,
        // which requires a disposition and a resolution summary and
        // writes the case timeline. Advancing may therefore move a
        // case from OPEN to IN_REVIEW but never to CLOSED.
        if (
                investigationCase.getStatus()
                        == InvestigationCaseEntity.CaseStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Resolve the case with a disposition and a "
                            + "resolution summary to close it."
            );
        }

        investigationCase.advance(Instant.now());

        return toView(
                caseRepository.save(investigationCase)
        );
    }

    private InvestigationCaseView createFromAlert(
            UUID alertId
    ) {
        AlertEntity alert =
                alertRepository
                        .findById(alertId)
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Alert not found: "
                                                + alertId
                                )
                        );

        Instant now = Instant.now();

        InvestigationCaseEntity investigationCase =
                new InvestigationCaseEntity(
                        UUID.randomUUID(),
                        "CASE-" + alert.getAlertCode(),
                        alert.getTitle(),
                        InvestigationCaseEntity.CaseStatus.OPEN,
                        InvestigationCaseEntity.CasePriority.valueOf(
                                alert.getSeverity().name()
                        ),
                        "Investigation opened from alert "
                                + alert.getAlertCode()
                                + ". "
                                + alert.getDescription(),
                        null,
                        alert,
                        now,
                        now
                );

        return toView(
                caseRepository.save(investigationCase)
        );
    }

    private InvestigationCaseView toView(
            InvestigationCaseEntity investigationCase
    ) {
        AlertEntity alert =
                investigationCase.getPrimaryAlert();

        return new InvestigationCaseView(
                investigationCase.getId().toString(),
                investigationCase.getCaseNumber(),
                investigationCase.getTitle(),
                investigationCase.getStatus().name(),
                investigationCase.getPriority().name(),
                investigationCase.getSummary(),
                investigationCase.getAssignedTo(),
                alert.getId().toString(),
                alert.getAlertCode(),
                alert.getRiskScore(),
                investigationCase.getCreatedAt(),
                investigationCase.getUpdatedAt()
        );
    }

    public record InvestigationCaseView(
            String id,
            String caseNumber,
            String title,
            String status,
            String priority,
            String summary,
            String assignedTo,
            String primaryAlertId,
            String primaryAlertCode,
            int alertRiskScore,
            Instant createdAt,
            Instant updatedAt
    ) {
    }
}
