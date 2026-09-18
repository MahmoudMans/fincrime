package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.CaseEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseEventRepository
        extends JpaRepository<CaseEventEntity, UUID> {

    List<CaseEventEntity>
    findByInvestigationCase_IdOrderByCreatedAtAsc(
            UUID caseId
    );
}
