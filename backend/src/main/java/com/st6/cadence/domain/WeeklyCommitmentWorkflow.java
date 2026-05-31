package com.st6.cadence.domain;

import com.st6.cadence.repository.SupportingOutcomeRepository;
import com.st6.cadence.repository.WeeklyCommitmentRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WeeklyCommitmentWorkflow {
  private final WeeklyCommitmentRepository weeklyCommitmentRepository;
  private final SupportingOutcomeRepository supportingOutcomeRepository;

  public WeeklyCommitmentWorkflow(
      WeeklyCommitmentRepository weeklyCommitmentRepository,
      SupportingOutcomeRepository supportingOutcomeRepository) {
    this.weeklyCommitmentRepository = weeklyCommitmentRepository;
    this.supportingOutcomeRepository = supportingOutcomeRepository;
  }

  @Transactional(readOnly = true)
  public Page<WeeklyCommitment> currentWeek(Pageable pageable) {
    return weeklyCommitmentRepository.findByWeekStart(currentWeekStart(), pageable);
  }

  @Transactional(readOnly = true)
  public Page<WeeklyCommitment> managerCommitments(CommitmentStatus status, Pageable pageable) {
    LocalDate weekStart = currentWeekStart();
    if (status == null) {
      return weeklyCommitmentRepository.findByWeekStart(weekStart, pageable);
    }
    return weeklyCommitmentRepository.findByWeekStartAndStatus(weekStart, status, pageable);
  }

  @Transactional(readOnly = true)
  public WeeklyCommitment get(UUID id) {
    return findCommitment(id);
  }

  @Transactional
  public WeeklyCommitment create(
      CommitmentActor actor,
      UUID supportingOutcomeId,
      String title,
      String plannedValue,
      ChessLayer chessLayer,
      LocalDate dueDate,
      Integer confidence,
      String ownerName) {
    SupportingOutcome outcome = findOutcome(supportingOutcomeId);
    String resolvedOwnerName = ownerName == null || ownerName.isBlank() ? actor.name() : ownerName;

    WeeklyCommitment commitment =
        WeeklyCommitment.builder()
            .supportingOutcome(outcome)
            .ownerSubject(actor.subject())
            .ownerName(resolvedOwnerName)
            .title(requireText(title, "title"))
            .plannedValue(requireText(plannedValue, "plannedValue"))
            .status(CommitmentStatus.DRAFT)
            .chessLayer(requireValue(chessLayer, "chessLayer"))
            .weekStart(currentWeekStart())
            .dueDate(requireValue(dueDate, "dueDate"))
            .confidence(normalizeConfidence(confidence))
            .build();

    return weeklyCommitmentRepository.save(commitment);
  }

  @Transactional
  public WeeklyCommitment update(
      CommitmentActor actor,
      UUID id,
      UUID supportingOutcomeId,
      String title,
      String plannedValue,
      ChessLayer chessLayer,
      LocalDate dueDate,
      Integer confidence,
      String ownerName) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    assertEditable(commitment);

    if (supportingOutcomeId != null) {
      commitment.setSupportingOutcome(findOutcome(supportingOutcomeId));
    }
    if (title != null) {
      commitment.setTitle(requireText(title, "title"));
    }
    if (plannedValue != null) {
      commitment.setPlannedValue(requireText(plannedValue, "plannedValue"));
    }
    if (chessLayer != null) {
      commitment.setChessLayer(chessLayer);
    }
    if (dueDate != null) {
      commitment.setDueDate(dueDate);
    }
    if (confidence != null) {
      commitment.setConfidence(normalizeConfidence(confidence));
    }
    if (ownerName != null && !ownerName.isBlank()) {
      commitment.setOwnerName(ownerName);
    }
    commitment.setStatus(CommitmentStatus.DRAFT);

    return weeklyCommitmentRepository.save(commitment);
  }

  @Transactional
  public void delete(CommitmentActor actor, UUID id) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    assertEditable(commitment);
    weeklyCommitmentRepository.delete(commitment);
  }

  @Transactional
  public WeeklyCommitment lock(CommitmentActor actor, UUID id) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.LOCKED);

    commitment.setStatus(CommitmentStatus.LOCKED);
    commitment.setLockedAt(Instant.now());
    return weeklyCommitmentRepository.save(commitment);
  }

  @Transactional
  public WeeklyCommitment review(
      CommitmentActor actor, UUID id, boolean approved, String reviewNote) {
    if (!actor.manager()) {
      throw new AccessDeniedException("Only a manager or director can review commitments");
    }

    WeeklyCommitment commitment = findCommitment(id);
    requireTransition(
        commitment, approved ? CommitmentStatus.APPROVED : CommitmentStatus.NEEDS_REVISION);

    commitment.setStatus(approved ? CommitmentStatus.APPROVED : CommitmentStatus.NEEDS_REVISION);
    commitment.setManagerSubject(actor.subject());
    commitment.setManagerName(actor.name());
    commitment.setReviewNote(reviewNote);
    commitment.setReviewedAt(Instant.now());
    return weeklyCommitmentRepository.save(commitment);
  }

  @Transactional
  public WeeklyCommitment startReconciliation(CommitmentActor actor, UUID id) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.RECONCILING);

    commitment.setStatus(CommitmentStatus.RECONCILING);
    return weeklyCommitmentRepository.save(commitment);
  }

  @Transactional
  public WeeklyCommitment reconcile(
      CommitmentActor actor, UUID id, String actualValue, String proof, boolean carryForward) {
    if (carryForward) {
      return carryForward(actor, id, actualValue, proof, null).closedCommitment();
    }

    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.RECONCILED);

    commitment.setActualValue(requireText(actualValue, "actualValue"));
    commitment.setProof(proof);
    commitment.setStatus(CommitmentStatus.RECONCILED);
    commitment.setReconciledAt(Instant.now());
    return weeklyCommitmentRepository.save(commitment);
  }

  @Transactional
  public CarryForwardResult carryForward(
      CommitmentActor actor, UUID id, String actualValue, String proof, LocalDate dueDate) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.CARRIED_FORWARD);

    commitment.setActualValue(requireText(actualValue, "actualValue"));
    commitment.setProof(proof);
    commitment.setStatus(CommitmentStatus.CARRIED_FORWARD);
    commitment.setReconciledAt(Instant.now());
    WeeklyCommitment closedCommitment = weeklyCommitmentRepository.save(commitment);

    WeeklyCommitment nextCommitment =
        WeeklyCommitment.builder()
            .supportingOutcome(commitment.getSupportingOutcome())
            .ownerSubject(commitment.getOwnerSubject())
            .ownerName(commitment.getOwnerName())
            .title(commitment.getTitle())
            .plannedValue(commitment.getPlannedValue())
            .status(CommitmentStatus.DRAFT)
            .chessLayer(commitment.getChessLayer())
            .weekStart(commitment.getWeekStart().plusWeeks(1))
            .dueDate(dueDate == null ? commitment.getDueDate().plusWeeks(1) : dueDate)
            .confidence(commitment.getConfidence())
            .carriedForwardFromId(commitment.getId())
            .build();

    return new CarryForwardResult(
        closedCommitment, weeklyCommitmentRepository.save(nextCommitment));
  }

  @Transactional
  public WeeklyCommitment transition(
      CommitmentActor actor,
      UUID id,
      CommitmentStatus targetStatus,
      String actualValue,
      String proof,
      String reviewNote) {
    return switch (requireValue(targetStatus, "targetStatus")) {
      case DRAFT -> reopenDraft(actor, id);
      case LOCKED -> lock(actor, id);
      case APPROVED -> review(actor, id, true, reviewNote);
      case NEEDS_REVISION -> review(actor, id, false, reviewNote);
      case RECONCILING -> startReconciliation(actor, id);
      case RECONCILED -> reconcile(actor, id, actualValue, proof, false);
      case CARRIED_FORWARD -> carryForward(actor, id, actualValue, proof, null).closedCommitment();
    };
  }

  private WeeklyCommitment reopenDraft(CommitmentActor actor, UUID id) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.DRAFT);
    commitment.setStatus(CommitmentStatus.DRAFT);
    return weeklyCommitmentRepository.save(commitment);
  }

  private WeeklyCommitment findCommitment(UUID id) {
    return weeklyCommitmentRepository
        .findByIdWithRcdo(requireValue(id, "id"))
        .orElseThrow(() -> new NoSuchElementException("Commitment not found: " + id));
  }

  private SupportingOutcome findOutcome(UUID id) {
    return supportingOutcomeRepository
        .findById(requireValue(id, "supportingOutcomeId"))
        .orElseThrow(() -> new NoSuchElementException("Supporting outcome not found: " + id));
  }

  private void assertOwnerOrManager(CommitmentActor actor, WeeklyCommitment commitment) {
    if (!actor.manager() && !actor.owns(commitment)) {
      throw new AccessDeniedException("Only the owner, manager, or director can change this");
    }
  }

  private void assertEditable(WeeklyCommitment commitment) {
    if (commitment.getStatus() != CommitmentStatus.DRAFT
        && commitment.getStatus() != CommitmentStatus.NEEDS_REVISION) {
      throw new InvalidCommitmentTransitionException(
          "Commitment can only be changed while draft or awaiting revision");
    }
  }

  private void requireTransition(WeeklyCommitment commitment, CommitmentStatus targetStatus) {
    CommitmentStatus currentStatus = commitment.getStatus();
    boolean valid =
        switch (currentStatus) {
          case DRAFT -> targetStatus == CommitmentStatus.LOCKED;
          case NEEDS_REVISION ->
              targetStatus == CommitmentStatus.DRAFT || targetStatus == CommitmentStatus.LOCKED;
          case LOCKED ->
              targetStatus == CommitmentStatus.APPROVED
                  || targetStatus == CommitmentStatus.NEEDS_REVISION;
          case APPROVED ->
              targetStatus == CommitmentStatus.RECONCILING
                  || targetStatus == CommitmentStatus.RECONCILED
                  || targetStatus == CommitmentStatus.CARRIED_FORWARD;
          case RECONCILING ->
              targetStatus == CommitmentStatus.RECONCILED
                  || targetStatus == CommitmentStatus.CARRIED_FORWARD;
          case RECONCILED, CARRIED_FORWARD -> false;
        };

    if (!valid) {
      throw new InvalidCommitmentTransitionException(currentStatus, targetStatus);
    }
  }

  private LocalDate currentWeekStart() {
    return LocalDate.now().with(DayOfWeek.MONDAY);
  }

  private String requireText(String value, String fieldName) {
    if (value == null || value.isBlank()) {
      throw new IllegalArgumentException(fieldName + " is required");
    }
    return value;
  }

  private <T> T requireValue(T value, String fieldName) {
    if (value == null) {
      throw new IllegalArgumentException(fieldName + " is required");
    }
    return value;
  }

  private int normalizeConfidence(Integer confidence) {
    if (confidence == null) {
      return 50;
    }
    if (confidence < 0 || confidence > 100) {
      throw new IllegalArgumentException("confidence must be between 0 and 100");
    }
    return confidence;
  }
}
