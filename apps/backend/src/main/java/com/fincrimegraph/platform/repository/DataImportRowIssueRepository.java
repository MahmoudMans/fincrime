package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.DataImportRowIssueEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DataImportRowIssueRepository
        extends JpaRepository<DataImportRowIssueEntity, UUID> {

    List<DataImportRowIssueEntity>
    findByJobIdOrderByRowNumberAsc(
            UUID jobId
    );

    void deleteByJobId(
            UUID jobId
    );
}
