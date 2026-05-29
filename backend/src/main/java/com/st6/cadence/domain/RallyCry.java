package com.st6.cadence.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
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

  protected RallyCry() {}

  @Builder
  public RallyCry(UUID id, String title) {
    this.id = id;
    this.title = title;
  }
}
