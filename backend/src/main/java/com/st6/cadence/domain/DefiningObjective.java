package com.st6.cadence.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "defining_objectives")
public class DefiningObjective extends AbstractAuditingEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "rally_cry_id", nullable = false)
  private RallyCry rallyCry;

  @Column(nullable = false)
  private String title;

  protected DefiningObjective() {}

  @Builder
  public DefiningObjective(UUID id, RallyCry rallyCry, String title) {
    this.id = id;
    this.rallyCry = rallyCry;
    this.title = title;
  }
}
