package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.CaseNoteEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseNoteRepository
        extends JpaRepository<CaseNoteEntity, UUID> {

    List<CaseNoteEntity>
    findByInvestigationCase_IdOrderByCreatedAtAsc(
            UUID caseId
    );
}
