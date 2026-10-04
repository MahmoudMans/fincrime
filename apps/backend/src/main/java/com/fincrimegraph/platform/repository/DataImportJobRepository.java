package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.DataImportJobEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DataImportJobRepository
        extends JpaRepository<DataImportJobEntity, UUID> {

    List<DataImportJobEntity>
    findTop50ByOrderByCreatedAtDesc();
}
