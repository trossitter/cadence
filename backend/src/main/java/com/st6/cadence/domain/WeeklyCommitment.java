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

  @Column(name = "proof")
  private String proof;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private CommitmentStatus status;

  @Column(name = "manager_subject")
  private String managerSubject;

  @Column(name = "manager_name")
  private String managerName;

  @Column(name = "review_note")
  private String reviewNote;

  @Column(name = "locked_at")
  private Instant lockedAt;

  @Column(name = "reviewed_at")
  private Instant reviewedAt;

  @Column(name = "reconciled_at")
  private Instant reconciledAt;

  @Column(name = "carried_forward_from_id")
  private UUID carriedForwardFromId;

  @Enumerated(EnumType.STRING)
  @Column(name = "chess_layer", nullable = false)
  private ChessLayer chessLayer;

  @Column(name = "week_start", nullable = false)
  private LocalDate weekStart;

  @Column(name = "due_date", nullable = false)
  private LocalDate dueDate;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private CommitmentRisk risk;

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
      String proof,
      CommitmentStatus status,
      String managerSubject,
      String managerName,
      String reviewNote,
      Instant lockedAt,
      Instant reviewedAt,
      Instant reconciledAt,
      UUID carriedForwardFromId,
      ChessLayer chessLayer,
      LocalDate weekStart,
      LocalDate dueDate,
      CommitmentRisk risk) {
    this.id = id;
    this.supportingOutcome = supportingOutcome;
    this.ownerSubject = ownerSubject;
    this.ownerName = ownerName;
    this.title = title;
    this.plannedValue = plannedValue;
    this.actualValue = actualValue;
    this.proof = proof;
    this.status = status;
    this.managerSubject = managerSubject;
    this.managerName = managerName;
    this.reviewNote = reviewNote;
    this.lockedAt = lockedAt;
    this.reviewedAt = reviewedAt;
    this.reconciledAt = reconciledAt;
    this.carriedForwardFromId = carriedForwardFromId;
    this.chessLayer = chessLayer;
    this.weekStart = weekStart;
    this.dueDate = dueDate;
    this.risk = risk;
  }
}
