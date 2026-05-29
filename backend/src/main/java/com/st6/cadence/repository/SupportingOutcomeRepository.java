package com.st6.cadence.repository;

import com.st6.cadence.domain.SupportingOutcome;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SupportingOutcomeRepository extends JpaRepository<SupportingOutcome, UUID> {}
