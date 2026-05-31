package com.st6.cadence.repository;

import com.st6.cadence.domain.CommitmentStatus;
import com.st6.cadence.domain.WeeklyCommitment;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WeeklyCommitmentRepository extends JpaRepository<WeeklyCommitment, UUID> {
  @EntityGraph(attributePaths = {"supportingOutcome.definingObjective.rallyCry"})
  Page<WeeklyCommitment> findByWeekStart(LocalDate weekStart, Pageable pageable);

  @EntityGraph(attributePaths = {"supportingOutcome.definingObjective.rallyCry"})
  Page<WeeklyCommitment> findByWeekStartAndStatus(
      LocalDate weekStart, CommitmentStatus status, Pageable pageable);

  @EntityGraph(attributePaths = {"supportingOutcome.definingObjective.rallyCry"})
  @Query("select commitment from WeeklyCommitment commitment where commitment.id = :id")
  Optional<WeeklyCommitment> findByIdWithRcdo(@Param("id") UUID id);
}
