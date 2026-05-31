package com.st6.cadence.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "rally_cries")
public class RallyCry extends AbstractAuditingEntity {
  @Id @GeneratedValue private UUID id;

  @Column(nullable = false)
  private String title;

  @Column(nullable = false)
  private boolean active = true;

  @Column(name = "archived_at")
  private Instant archivedAt;

  protected RallyCry() {}

  @Builder
  public RallyCry(UUID id, String title, Boolean active, Instant archivedAt) {
    this.id = id;
    this.title = title;
    this.active = active == null || active;
    this.archivedAt = archivedAt;
  }
}
