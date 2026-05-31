package com.st6.cadence.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
@Table(name = "supporting_outcomes")
public class SupportingOutcome extends AbstractAuditingEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "defining_objective_id", nullable = false)
  private DefiningObjective definingObjective;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "archived_at")
  private Instant archivedAt;

  protected SupportingOutcome() {}

  @Builder
  public SupportingOutcome(
      UUID id,
      DefiningObjective definingObjective,
      String title,
      Boolean active,
      Instant archivedAt) {
    this.id = id;
    this.definingObjective = definingObjective;
    this.title = title;
    this.active = active == null || active;
    this.archivedAt = archivedAt;
  }
}
