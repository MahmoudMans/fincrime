package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.CaseEvidenceEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseEvidenceRepository
        extends JpaRepository<CaseEvidenceEntity, UUID> {

    List<CaseEvidenceEntity>
    findByInvestigationCase_IdOrderByCreatedAtAsc(
            UUID caseId
    );

    boolean
    existsByInvestigationCase_IdAndReferenceTypeAndReferenceId(
            UUID caseId,
            CaseEvidenceEntity.ReferenceType referenceType,
            String referenceId
    );
}
