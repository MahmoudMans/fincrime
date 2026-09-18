package com.fincrimegraph.platform.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CaseReportServiceTest {

    private final CaseReportService service =
            new CaseReportService();

    @Test
    void generatesReadableInvestigationPdfWithEvidenceManifest()
            throws Exception {

        Instant created =
                Instant.parse(
                        "2026-09-18T10:00:00Z"
                );

        CaseWorkspaceService.PrimaryAlertView alert =
                new CaseWorkspaceService.PrimaryAlertView(
                        "alert-id",
                        "AUTO-CIRC-TEST",
                        "CIRCULAR_FLOW",
                        "CRITICAL",
                        96,
                        "OPEN",
                        "Circular money flow detected",
                        "FCG-100001",
                        "TXN-260903"
                );

        CaseWorkspaceService.NoteView note =
                new CaseWorkspaceService.NoteView(
                        "note-id",
                        "Senior AML Analyst",
                        "Reviewed the circular transfer sequence.",
                        created.plusSeconds(
                                60
                        )
                );

        CaseWorkspaceService.EvidenceView evidence =
                new CaseWorkspaceService.EvidenceView(
                        "evidence-id",
                        "GRAPH_CYCLE",
                        "GRAPH",
                        "ALL_3_HOP_CIRCULAR_FLOWS",
                        "Circular-flow graph evidence",
                        "Two circular transfer networks were preserved.",
                        "cycleCount=2;accounts=FCG-100001,FCG-100004,FCG-100006",
                        created.plusSeconds(
                                120
                        )
                );

        CaseWorkspaceService.EventView event =
                new CaseWorkspaceService.EventView(
                        "event-id",
                        "EVIDENCE_ATTACHED",
                        "Circular-flow graph evidence attached.",
                        "Senior AML Analyst",
                        created.plusSeconds(
                                120
                        )
                );

        CaseWorkspaceService.CaseWorkspaceView workspace =
                new CaseWorkspaceService.CaseWorkspaceView(
                        "case-id",
                        "CASE-TEST-001",
                        "Circular flow investigation",
                        "CLOSED",
                        "CRITICAL",
                        "Investigate a suspicious circular money movement.",
                        "Senior AML Analyst",
                        "ESCALATED",
                        "Escalated for enhanced financial-crime review.",
                        created.plusSeconds(
                                300
                        ),
                        created,
                        created.plusSeconds(
                                300
                        ),
                        alert,
                        List.of(
                                note
                        ),
                        List.of(
                                evidence
                        ),
                        List.of(
                                event
                        )
                );

        byte[] pdf =
                service.render(
                        workspace,
                        "senior@fincrime.local"
                );

        assertThat(
                pdf
        )
                .isNotEmpty()
                .startsWith(
                        "%PDF-"
                                .getBytes(
                                        java.nio.charset
                                                .StandardCharsets
                                                .US_ASCII
                                )
                );

        assertThat(
                pdf.length
        ).isGreaterThan(
                1000
        );

        assertThat(
                service.evidenceFingerprint(
                        evidence
                )
        )
                .hasSize(
                        64
                )
                .matches(
                        "[0-9a-f]{64}"
                );

        try (
                PDDocument document =
                        Loader.loadPDF(
                                pdf
                        )
        ) {
            assertThat(
                    document
                            .getNumberOfPages()
            ).isGreaterThanOrEqualTo(
                    1
            );

            assertThat(
                    document
                            .getDocumentInformation()
                            .getTitle()
            ).contains(
                    "CASE-TEST-001"
            );

            String text =
                    new PDFTextStripper()
                            .getText(
                                    document
                            );

            assertThat(
                    text
            )
                    .contains(
                            "FinCrime Graph Investigation Report"
                    )
                    .contains(
                            "CASE-TEST-001"
                    )
                    .contains(
                            "Circular money flow detected"
                    )
                    .contains(
                            "Preserved evidence"
                    )
                    .contains(
                            "SHA-256"
                    )
                    .contains(
                            "Analyst notes"
                    )
                    .contains(
                            "Investigation activity timeline"
                    )
                    .contains(
                            "ESCALATED"
                    );
        }
    }
}
