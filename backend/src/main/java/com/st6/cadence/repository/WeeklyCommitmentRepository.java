package com.st6.cadence.repository;

import com.st6.cadence.domain.WeeklyCommitment;
import java.time.LocalDate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklyCommitmentRepository extends JpaRepository<WeeklyCommitment, UUID> {
  @EntityGraph(attributePaths = {"supportingOutcome.definingObjective.rallyCry"})
  Page<WeeklyCommitment> findByWeekStart(LocalDate weekStart, Pageable pageable);
}
