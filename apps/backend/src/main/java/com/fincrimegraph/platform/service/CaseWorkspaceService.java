package com.fincrimegraph.platform.service;

import com.fincrimegraph.platform.domain.AlertEntity;
import com.fincrimegraph.platform.domain.CaseEvidenceEntity;
import com.fincrimegraph.platform.domain.CaseEventEntity;
import com.fincrimegraph.platform.domain.CaseNoteEntity;
import com.fincrimegraph.platform.domain.InvestigationCaseEntity;
import com.fincrimegraph.platform.domain.TransactionEntity;
import com.fincrimegraph.platform.repository.AlertRepository;
import com.fincrimegraph.platform.repository.CaseEvidenceRepository;
import com.fincrimegraph.platform.repository.CaseEventRepository;
import com.fincrimegraph.platform.repository.CaseNoteRepository;
import com.fincrimegraph.platform.repository.InvestigationCaseRepository;
import com.fincrimegraph.platform.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class CaseWorkspaceService {

    private static final String DEFAULT_ACTOR =
            "AML Analyst";

    private final InvestigationCaseRepository caseRepository;
    private final CaseNoteRepository noteRepository;
    private final CaseEvidenceRepository evidenceRepository;
    private final CaseEventRepository eventRepository;
    private final TransactionRepository transactionRepository;
    private final AlertRepository alertRepository;
    private final GraphInvestigationService graphInvestigationService;

    public CaseWorkspaceService(
            InvestigationCaseRepository caseRepository,
            CaseNoteRepository noteRepository,
            CaseEvidenceRepository evidenceRepository,
            CaseEventRepository eventRepository,
            TransactionRepository transactionRepository,
            AlertRepository alertRepository,
            GraphInvestigationService graphInvestigationService
    ) {
        this.caseRepository = caseRepository;
        this.noteRepository = noteRepository;
        this.evidenceRepository = evidenceRepository;
        this.eventRepository = eventRepository;
        this.transactionRepository = transactionRepository;
        this.alertRepository = alertRepository;
        this.graphInvestigationService = graphInvestigationService;
    }

    @Transactional(
            transactionManager = "transactionManager",
            readOnly = true
    )
    public CaseWorkspaceView workspace(
            UUID caseId
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        return toWorkspace(
                investigationCase
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public CaseWorkspaceView addNote(
            UUID caseId,
            String author,
            String body
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        String normalizedAuthor =
                normalizeActor(author);

        String normalizedBody =
                requireText(
                        body,
                        "note",
                        2000
                );

        Instant now = Instant.now();

        noteRepository.save(
                new CaseNoteEntity(
                        UUID.randomUUID(),
                        investigationCase,
                        normalizedAuthor,
                        normalizedBody,
                        now
                )
        );

        recordEvent(
                investigationCase,
                CaseEventEntity.EventType.NOTE_ADDED,
                "Analyst note added.",
                normalizedAuthor,
                now
        );

        return toWorkspace(
                investigationCase
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public CaseWorkspaceView assign(
            UUID caseId,
            String assignee,
            String actor
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        String normalizedAssignee =
                requireText(
                        assignee,
                        "assignee",
                        160
                );

        String normalizedActor =
                normalizeActor(actor);

        Instant now = Instant.now();

        investigationCase.assignTo(
                normalizedAssignee,
                now
        );

        caseRepository.save(
                investigationCase
        );

        recordEvent(
                investigationCase,
                CaseEventEntity.EventType.ASSIGNEE_CHANGED,
                "Case assigned to "
                        + normalizedAssignee
                        + ".",
                normalizedActor,
                now
        );

        return toWorkspace(
                investigationCase
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public CaseWorkspaceView attachAlert(
            UUID caseId,
            UUID alertId,
            String actor
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        AlertEntity alert =
                alertRepository
                        .findById(alertId)
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Alert not found: "
                                                + alertId
                                )
                        );

        String referenceId =
                alert.getId().toString();

        if (!evidenceRepository
                .existsByInvestigationCase_IdAndReferenceTypeAndReferenceId(
                        caseId,
                        CaseEvidenceEntity.ReferenceType.ALERT,
                        referenceId
                )) {

            Instant now = Instant.now();

            String snapshot =
                    "alertCode="
                            + alert.getAlertCode()
                            + ";type="
                            + alert.getAlertType().name()
                            + ";severity="
                            + alert.getSeverity().name()
                            + ";riskScore="
                            + alert.getRiskScore()
                            + ";status="
                            + alert.getStatus().name();

            evidenceRepository.save(
                    new CaseEvidenceEntity(
                            UUID.randomUUID(),
                            investigationCase,
                            CaseEvidenceEntity.EvidenceType.ALERT,
                            CaseEvidenceEntity.ReferenceType.ALERT,
                            referenceId,
                            "Alert "
                                    + alert.getAlertCode(),
                            alert.getTitle(),
                            snapshot,
                            now
                    )
            );

            recordEvent(
                    investigationCase,
                    CaseEventEntity.EventType.EVIDENCE_ATTACHED,
                    "Alert evidence "
                            + alert.getAlertCode()
                            + " attached.",
                    normalizeActor(actor),
                    now
            );
        }

        return toWorkspace(
                investigationCase
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public CaseWorkspaceView attachTransaction(
            UUID caseId,
            String reference,
            String actor
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        String normalizedReference =
                requireText(
                        reference,
                        "transaction reference",
                        64
                );

        TransactionEntity transaction =
                transactionRepository
                        .findByReference(
                                normalizedReference
                        )
                        .orElseThrow(
                                () -> new IllegalArgumentException(
                                        "Transaction not found: "
                                                + normalizedReference
                                )
                        );

        if (!evidenceRepository
                .existsByInvestigationCase_IdAndReferenceTypeAndReferenceId(
                        caseId,
                        CaseEvidenceEntity.ReferenceType.TRANSACTION,
                        normalizedReference
                )) {

            Instant now = Instant.now();

            String snapshot =
                    "reference="
                            + transaction.getReference()
                            + ";source="
                            + transaction
                            .getSourceAccount()
                            .getAccountNumber()
                            + ";destination="
                            + transaction
                            .getDestinationAccount()
                            .getAccountNumber()
                            + ";amount="
                            + transaction.getAmount()
                            + ";currency="
                            + transaction.getCurrency()
                            + ";channel="
                            + transaction.getChannel().name()
                            + ";status="
                            + transaction.getStatus().name()
                            + ";occurredAt="
                            + transaction.getOccurredAt();

            evidenceRepository.save(
                    new CaseEvidenceEntity(
                            UUID.randomUUID(),
                            investigationCase,
                            CaseEvidenceEntity.EvidenceType.TRANSACTION,
                            CaseEvidenceEntity.ReferenceType.TRANSACTION,
                            normalizedReference,
                            "Transaction "
                                    + normalizedReference,
                            "Money movement captured as investigation evidence.",
                            snapshot,
                            now
                    )
            );

            recordEvent(
                    investigationCase,
                    CaseEventEntity.EventType.EVIDENCE_ATTACHED,
                    "Transaction "
                            + normalizedReference
                            + " attached as evidence.",
                    normalizeActor(actor),
                    now
            );
        }

        return toWorkspace(
                investigationCase
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public CaseWorkspaceView attachCircularGraph(
            UUID caseId,
            String actor
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        String referenceId =
                "ALL_3_HOP_CIRCULAR_FLOWS";

        if (!evidenceRepository
                .existsByInvestigationCase_IdAndReferenceTypeAndReferenceId(
                        caseId,
                        CaseEvidenceEntity.ReferenceType.GRAPH,
                        referenceId
                )) {

            GraphInvestigationService.InvestigationGraph graph =
                    graphInvestigationService.circularFlows();

            if (!graph.found()) {
                throw new IllegalArgumentException(
                        "No circular-flow graph evidence is available."
                );
            }

            Instant now = Instant.now();

            String accounts =
                    graph.nodes()
                            .stream()
                            .map(
                                    GraphInvestigationService
                                            .InvestigationNode
                                            ::accountNumber
                            )
                            .sorted()
                            .reduce(
                                    (left, right) ->
                                            left
                                                    + ","
                                                    + right
                            )
                            .orElse("");

            String transactions =
                    graph.edges()
                            .stream()
                            .map(
                                    GraphInvestigationService
                                            .InvestigationEdge
                                            ::reference
                            )
                            .sorted()
                            .reduce(
                                    (left, right) ->
                                            left
                                                    + ","
                                                    + right
                            )
                            .orElse("");

            String snapshot =
                    "cycleCount="
                            + graph.cycleCount()
                            + ";accounts="
                            + accounts
                            + ";transactions="
                            + transactions;

            evidenceRepository.save(
                    new CaseEvidenceEntity(
                            UUID.randomUUID(),
                            investigationCase,
                            CaseEvidenceEntity.EvidenceType.GRAPH_CYCLE,
                            CaseEvidenceEntity.ReferenceType.GRAPH,
                            referenceId,
                            "Circular-flow graph evidence",
                            graph.description(),
                            snapshot,
                            now
                    )
            );

            recordEvent(
                    investigationCase,
                    CaseEventEntity.EventType.EVIDENCE_ATTACHED,
                    "Circular-flow graph evidence attached.",
                    normalizeActor(actor),
                    now
            );
        }

        return toWorkspace(
                investigationCase
        );
    }

    @Transactional(
            transactionManager = "transactionManager"
    )
    public CaseWorkspaceView resolve(
            UUID caseId,
            String disposition,
            String summary,
            String actor
    ) {
        InvestigationCaseEntity investigationCase =
                requireCase(caseId);

        InvestigationCaseEntity.CaseDisposition
                parsedDisposition =
                parseDisposition(
                        disposition
                );

        String normalizedSummary =
                requireText(
                        summary,
                        "resolution summary",
                        2000
                );

        String normalizedActor =
                normalizeActor(actor);

        Instant now = Instant.now();

        investigationCase.resolve(
                parsedDisposition,
                normalizedSummary,
                now
        );

        caseRepository.save(
                investigationCase
        );

        recordEvent(
                investigationCase,
                CaseEventEntity.EventType.CASE_RESOLVED,
                "Case resolved with disposition "
                        + parsedDisposition.name()
                        + ".",
                normalizedActor,
                now
        );

        return toWorkspace(
                investigationCase
        );
    }

    private InvestigationCaseEntity requireCase(
            UUID caseId
    ) {
        return caseRepository
                .findById(caseId)
                .orElseThrow(
                        () -> new IllegalArgumentException(
                                "Investigation case not found: "
                                        + caseId
                        )
                );
    }

    private InvestigationCaseEntity.CaseDisposition
    parseDisposition(
            String value
    ) {
        String normalized =
                requireText(
                        value,
                        "disposition",
                        40
                )
                        .toUpperCase(
                                Locale.ROOT
                        );

        try {
            return InvestigationCaseEntity
                    .CaseDisposition
                    .valueOf(normalized);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "Unsupported case disposition: "
                            + value
            );
        }
    }

    private String normalizeActor(
            String value
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            return DEFAULT_ACTOR;
        }

        String normalized =
                value.trim();

        if (normalized.length() > 160) {
            throw new IllegalArgumentException(
                    "actor exceeds 160 characters."
            );
        }

        return normalized;
    }

    private String requireText(
            String value,
            String field,
            int maximumLength
    ) {
        if (
                value == null
                        || value.isBlank()
        ) {
            throw new IllegalArgumentException(
                    field
                            + " is required."
            );
        }

        String normalized =
                value.trim();

        if (
                normalized.length()
                        > maximumLength
        ) {
            throw new IllegalArgumentException(
                    field
                            + " exceeds "
                            + maximumLength
                            + " characters."
            );
        }

        return normalized;
    }

    private void recordEvent(
            InvestigationCaseEntity investigationCase,
            CaseEventEntity.EventType eventType,
            String description,
            String actor,
            Instant createdAt
    ) {
        eventRepository.save(
                new CaseEventEntity(
                        UUID.randomUUID(),
                        investigationCase,
                        eventType,
                        description,
                        actor,
                        createdAt
                )
        );
    }

    private CaseWorkspaceView toWorkspace(
            InvestigationCaseEntity investigationCase
    ) {
        UUID caseId =
                investigationCase.getId();

        AlertEntity primaryAlert =
                investigationCase
                        .getPrimaryAlert();

        PrimaryAlertView alertView =
                new PrimaryAlertView(
                        primaryAlert
                                .getId()
                                .toString(),
                        primaryAlert
                                .getAlertCode(),
                        primaryAlert
                                .getAlertType()
                                .name(),
                        primaryAlert
                                .getSeverity()
                                .name(),
                        primaryAlert
                                .getRiskScore(),
                        primaryAlert
                                .getStatus()
                                .name(),
                        primaryAlert
                                .getTitle(),
                        primaryAlert
                                        .getPrimaryAccount()
                                == null
                                ? null
                                : primaryAlert
                                .getPrimaryAccount()
                                .getAccountNumber(),
                        primaryAlert
                                        .getTransaction()
                                == null
                                ? null
                                : primaryAlert
                                .getTransaction()
                                .getReference()
                );

        List<NoteView> notes =
                noteRepository
                        .findByInvestigationCase_IdOrderByCreatedAtAsc(
                                caseId
                        )
                        .stream()
                        .map(
                                note ->
                                        new NoteView(
                                                note
                                                        .getId()
                                                        .toString(),
                                                note
                                                        .getAuthorName(),
                                                note
                                                        .getBody(),
                                                note
                                                        .getCreatedAt()
                                        )
                        )
                        .toList();

        List<EvidenceView> evidence =
                evidenceRepository
                        .findByInvestigationCase_IdOrderByCreatedAtAsc(
                                caseId
                        )
                        .stream()
                        .map(
                                item ->
                                        new EvidenceView(
                                                item
                                                        .getId()
                                                        .toString(),
                                                item
                                                        .getEvidenceType()
                                                        .name(),
                                                item
                                                        .getReferenceType()
                                                        .name(),
                                                item
                                                        .getReferenceId(),
                                                item
                                                        .getTitle(),
                                                item
                                                        .getDescription(),
                                                item
                                                        .getSnapshotText(),
                                                item
                                                        .getCreatedAt()
                                        )
                        )
                        .toList();

        List<EventView> timeline =
                eventRepository
                        .findByInvestigationCase_IdOrderByCreatedAtAsc(
                                caseId
                        )
                        .stream()
                        .map(
                                event ->
                                        new EventView(
                                                event
                                                        .getId()
                                                        .toString(),
                                                event
                                                        .getEventType()
                                                        .name(),
                                                event
                                                        .getDescription(),
                                                event
                                                        .getActorName(),
                                                event
                                                        .getCreatedAt()
                                        )
                        )
                        .toList();

        return new CaseWorkspaceView(
                investigationCase
                        .getId()
                        .toString(),
                investigationCase
                        .getCaseNumber(),
                investigationCase
                        .getTitle(),
                investigationCase
                        .getStatus()
                        .name(),
                investigationCase
                        .getPriority()
                        .name(),
                investigationCase
                        .getSummary(),
                investigationCase
                        .getAssignedTo(),
                investigationCase
                                .getDisposition()
                        == null
                        ? null
                        : investigationCase
                        .getDisposition()
                        .name(),
                investigationCase
                        .getResolutionSummary(),
                investigationCase
                        .getClosedAt(),
                investigationCase
                        .getCreatedAt(),
                investigationCase
                        .getUpdatedAt(),
                alertView,
                notes,
                evidence,
                timeline
        );
    }

    public record PrimaryAlertView(
            String id,
            String code,
            String type,
            String severity,
            int riskScore,
            String status,
            String title,
            String accountNumber,
            String transactionReference
    ) {
    }

    public record NoteView(
            String id,
            String authorName,
            String body,
            Instant createdAt
    ) {
    }

    public record EvidenceView(
            String id,
            String evidenceType,
            String referenceType,
            String referenceId,
            String title,
            String description,
            String snapshotText,
            Instant createdAt
    ) {
    }

    public record EventView(
            String id,
            String eventType,
            String description,
            String actorName,
            Instant createdAt
    ) {
    }

    public record CaseWorkspaceView(
            String id,
            String caseNumber,
            String title,
            String status,
            String priority,
            String summary,
            String assignedTo,
            String disposition,
            String resolutionSummary,
            Instant closedAt,
            Instant createdAt,
            Instant updatedAt,
            PrimaryAlertView primaryAlert,
            List<NoteView> notes,
            List<EvidenceView> evidence,
            List<EventView> timeline
    ) {
    }
}
