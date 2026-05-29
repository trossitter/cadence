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
import java.time.LocalDate;
import java.util.UUID;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "weekly_commitments")
public class WeeklyCommitment extends AbstractAuditingEntity {
  @Id @GeneratedValue private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "supporting_outcome_id", nullable = false)
  private SupportingOutcome supportingOutcome;

  @Column(name = "owner_subject", nullable = false)
  private String ownerSubject;

  @Column(name = "owner_name", nullable = false)
  private String ownerName;

  @Column(nullable = false)
  private String title;

  @Column(name = "planned_value", nullable = false)
  private String plannedValue;

  @Column(name = "actual_value")
  private String actualValue;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private CommitmentStatus status;

  @Enumerated(EnumType.STRING)
  @Column(name = "chess_layer", nullable = false)
  private ChessLayer chessLayer;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Column(name = "due_date", nullable = false)
  private LocalDate dueDate;

  @Column(nullable = false)
  private int confidence;

  protected WeeklyCommitment() {}

  @Builder
  public WeeklyCommitment(
      UUID id,
      SupportingOutcome supportingOutcome,
      String ownerSubject,
      String ownerName,
      String title,
      String plannedValue,
      String actualValue,
      CommitmentStatus status,
      ChessLayer chessLayer,
      LocalDate weekStart,
      LocalDate dueDate,
      int confidence) {
    this.id = id;
    this.supportingOutcome = supportingOutcome;
    this.ownerSubject = ownerSubject;
    this.ownerName = ownerName;
    this.title = title;
    this.plannedValue = plannedValue;
    this.actualValue = actualValue;
    this.status = status;
    this.chessLayer = chessLayer;
    this.weekStart = weekStart;
    this.dueDate = dueDate;
    this.confidence = confidence;
  }
}
