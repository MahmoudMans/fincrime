package com.fincrimegraph.platform.repository;

import com.fincrimegraph.platform.domain.WatchlistEntryEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WatchlistEntryRepository
        extends JpaRepository<WatchlistEntryEntity, UUID> {

    List<WatchlistEntryEntity>
    findByActiveTrueOrderByFullNameAsc();

    List<WatchlistEntryEntity>
    findAllByOrderByFullNameAsc();
}
