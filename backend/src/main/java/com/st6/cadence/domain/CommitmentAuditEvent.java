package com.st6.cadence.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "commitment_audit_events")
public class CommitmentAuditEvent extends AbstractAuditingEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "commitment_id", nullable = false)
  private WeeklyCommitment commitment;

  @Column(name = "actor_subject", nullable = false)
  private String actorSubject;

  @Column(name = "actor_name", nullable = false)
  private String actorName;

  @Enumerated(EnumType.STRING)
  @Column(name = "from_status")
  private CommitmentStatus fromStatus;

  @Enumerated(EnumType.STRING)
  @Column(name = "to_status", nullable = false)
  private CommitmentStatus toStatus;

  @Column(name = "changed_fields", columnDefinition = "jsonb", nullable = false)
  private String changedFieldsJson;

  @Column(name = "occurred_at", nullable = false)
  private Instant occurredAt;

  protected CommitmentAuditEvent() {}

  @Builder
  public CommitmentAuditEvent(
      UUID id,
      WeeklyCommitment commitment,
      String actorSubject,
      String actorName,
      CommitmentStatus fromStatus,
      CommitmentStatus toStatus,
      String changedFieldsJson,
      Instant occurredAt) {
    this.id = id;
    this.commitment = commitment;
    this.actorSubject = actorSubject;
    this.actorName = actorName;
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.changedFieldsJson = changedFieldsJson;
    this.occurredAt = occurredAt;
  }
}
