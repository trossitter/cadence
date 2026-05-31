package com.st6.cadence.repository;

import com.st6.cadence.domain.CommitmentAuditEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommitmentAuditEventRepository extends JpaRepository<CommitmentAuditEvent, UUID> {
  List<CommitmentAuditEvent> findByCommitmentIdOrderByOccurredAtAsc(UUID commitmentId);
}
