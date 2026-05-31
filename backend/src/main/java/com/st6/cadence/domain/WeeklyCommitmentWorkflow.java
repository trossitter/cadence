package com.st6.cadence.domain;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.st6.cadence.repository.CommitmentAuditEventRepository;
import com.st6.cadence.repository.SupportingOutcomeRepository;
import com.st6.cadence.repository.WeeklyCommitmentRepository;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
  private final CommitmentAuditEventRepository commitmentAuditEventRepository;
  private final ObjectMapper objectMapper;

  public WeeklyCommitmentWorkflow(
      WeeklyCommitmentRepository weeklyCommitmentRepository,
      SupportingOutcomeRepository supportingOutcomeRepository,
      CommitmentAuditEventRepository commitmentAuditEventRepository,
      ObjectMapper objectMapper) {
    this.weeklyCommitmentRepository = weeklyCommitmentRepository;
    this.supportingOutcomeRepository = supportingOutcomeRepository;
    this.commitmentAuditEventRepository = commitmentAuditEventRepository;
    this.objectMapper = objectMapper;
  }

  public record CommitmentSignals(
      int weeksCarried, LocalDate originWeekStart, List<CommitmentAuditEvent> auditEvents) {
    public static CommitmentSignals empty(WeeklyCommitment commitment) {
      return new CommitmentSignals(0, commitment.getWeekStart(), List.of());
    }
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

  @Transactional(readOnly = true)
  public CommitmentSignals signalsFor(WeeklyCommitment commitment) {
    WeeklyCommitment ancestor = commitment;
    int weeksCarried = 0;
    LocalDate originWeekStart = commitment.getWeekStart();

    while (ancestor.getCarriedForwardFromId() != null) {
      ancestor =
          weeklyCommitmentRepository
              .findByIdWithRcdo(ancestor.getCarriedForwardFromId())
              .orElse(null);

      if (ancestor == null) {
        break;
      }

      weeksCarried++;
      originWeekStart = ancestor.getWeekStart();
    }

    return new CommitmentSignals(
        weeksCarried,
        originWeekStart,
        commitmentAuditEventRepository.findByCommitmentIdOrderByOccurredAtAsc(commitment.getId()));
  }

  @Transactional
  public WeeklyCommitment create(
      CommitmentActor actor,
      UUID supportingOutcomeId,
      String title,
      String plannedValue,
      ChessLayer chessLayer,
      LocalDate dueDate,
      CommitmentRisk risk,
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
            .risk(normalizeRisk(risk))
            .build();

    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(actor, savedCommitment, null, CommitmentStatus.DRAFT, Map.of());
    return savedCommitment;
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
      CommitmentRisk risk,
      String ownerName) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    assertEditable(commitment);
    CommitmentStatus fromStatus = commitment.getStatus();
    Map<String, List<Object>> changedFields = new LinkedHashMap<>();

    if (supportingOutcomeId != null) {
      addChange(
          changedFields,
          "supportingOutcomeId",
          commitment.getSupportingOutcome().getId(),
          supportingOutcomeId);
      commitment.setSupportingOutcome(findOutcome(supportingOutcomeId));
    }
    if (title != null) {
      addChange(changedFields, "title", commitment.getTitle(), title);
      commitment.setTitle(requireText(title, "title"));
    }
    if (plannedValue != null) {
      addChange(changedFields, "plannedValue", commitment.getPlannedValue(), plannedValue);
      commitment.setPlannedValue(requireText(plannedValue, "plannedValue"));
    }
    if (chessLayer != null) {
      addChange(changedFields, "chessLayer", commitment.getChessLayer(), chessLayer);
      commitment.setChessLayer(chessLayer);
    }
    if (dueDate != null) {
      addChange(changedFields, "dueDate", commitment.getDueDate(), dueDate);
      commitment.setDueDate(dueDate);
    }
    if (risk != null) {
      addChange(changedFields, "risk", commitment.getRisk(), risk);
      commitment.setRisk(normalizeRisk(risk));
    }
    if (ownerName != null && !ownerName.isBlank()) {
      addChange(changedFields, "ownerName", commitment.getOwnerName(), ownerName);
      commitment.setOwnerName(ownerName);
    }
    commitment.setStatus(CommitmentStatus.DRAFT);
    addChange(changedFields, "status", fromStatus, CommitmentStatus.DRAFT);

    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(actor, savedCommitment, fromStatus, savedCommitment.getStatus(), changedFields);
    return savedCommitment;
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
    CommitmentStatus fromStatus = commitment.getStatus();

    commitment.setStatus(CommitmentStatus.LOCKED);
    commitment.setLockedAt(Instant.now());
    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(
        actor,
        savedCommitment,
        fromStatus,
        CommitmentStatus.LOCKED,
        statusChange(fromStatus, CommitmentStatus.LOCKED));
    return savedCommitment;
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
    CommitmentStatus fromStatus = commitment.getStatus();
    CommitmentStatus toStatus =
        approved ? CommitmentStatus.APPROVED : CommitmentStatus.NEEDS_REVISION;
    Map<String, List<Object>> changedFields = statusChange(fromStatus, toStatus);
    addChange(changedFields, "managerName", commitment.getManagerName(), actor.name());
    addChange(changedFields, "reviewNote", commitment.getReviewNote(), reviewNote);

    commitment.setStatus(toStatus);
    commitment.setManagerSubject(actor.subject());
    commitment.setManagerName(actor.name());
    commitment.setReviewNote(reviewNote);
    commitment.setReviewedAt(Instant.now());
    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(actor, savedCommitment, fromStatus, toStatus, changedFields);
    return savedCommitment;
  }

  @Transactional
  public WeeklyCommitment startReconciliation(CommitmentActor actor, UUID id) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.RECONCILING);
    CommitmentStatus fromStatus = commitment.getStatus();

    commitment.setStatus(CommitmentStatus.RECONCILING);
    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(
        actor,
        savedCommitment,
        fromStatus,
        CommitmentStatus.RECONCILING,
        statusChange(fromStatus, CommitmentStatus.RECONCILING));
    return savedCommitment;
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
    CommitmentStatus fromStatus = commitment.getStatus();
    Map<String, List<Object>> changedFields = statusChange(fromStatus, CommitmentStatus.RECONCILED);
    addChange(changedFields, "actualValue", commitment.getActualValue(), actualValue);
    addChange(changedFields, "proof", commitment.getProof(), proof);

    commitment.setActualValue(requireText(actualValue, "actualValue"));
    commitment.setProof(proof);
    commitment.setStatus(CommitmentStatus.RECONCILED);
    commitment.setReconciledAt(Instant.now());
    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(actor, savedCommitment, fromStatus, CommitmentStatus.RECONCILED, changedFields);
    return savedCommitment;
  }

  @Transactional
  public CarryForwardResult carryForward(
      CommitmentActor actor, UUID id, String actualValue, String proof, LocalDate dueDate) {
    WeeklyCommitment commitment = findCommitment(id);
    assertOwnerOrManager(actor, commitment);
    requireTransition(commitment, CommitmentStatus.CARRIED_FORWARD);
    CommitmentStatus fromStatus = commitment.getStatus();
    Map<String, List<Object>> closedChangedFields =
        statusChange(fromStatus, CommitmentStatus.CARRIED_FORWARD);
    addChange(closedChangedFields, "actualValue", commitment.getActualValue(), actualValue);
    addChange(closedChangedFields, "proof", commitment.getProof(), proof);

    commitment.setActualValue(requireText(actualValue, "actualValue"));
    commitment.setProof(proof);
    commitment.setStatus(CommitmentStatus.CARRIED_FORWARD);
    commitment.setReconciledAt(Instant.now());
    WeeklyCommitment closedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(
        actor, closedCommitment, fromStatus, CommitmentStatus.CARRIED_FORWARD, closedChangedFields);

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
            .risk(commitment.getRisk())
            .carriedForwardFromId(commitment.getId())
            .build();
    WeeklyCommitment savedNextCommitment = weeklyCommitmentRepository.save(nextCommitment);
    recordEvent(actor, savedNextCommitment, null, CommitmentStatus.DRAFT, Map.of());

    return new CarryForwardResult(closedCommitment, savedNextCommitment);
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
    CommitmentStatus fromStatus = commitment.getStatus();
    commitment.setStatus(CommitmentStatus.DRAFT);
    WeeklyCommitment savedCommitment = weeklyCommitmentRepository.save(commitment);
    recordEvent(
        actor,
        savedCommitment,
        fromStatus,
        CommitmentStatus.DRAFT,
        statusChange(fromStatus, CommitmentStatus.DRAFT));
    return savedCommitment;
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

  private CommitmentRisk normalizeRisk(CommitmentRisk risk) {
    return risk == null ? CommitmentRisk.ON_TRACK : risk;
  }

  private void recordEvent(
      CommitmentActor actor,
      WeeklyCommitment commitment,
      CommitmentStatus fromStatus,
      CommitmentStatus toStatus,
      Map<String, List<Object>> changedFields) {
    commitmentAuditEventRepository.save(
        CommitmentAuditEvent.builder()
            .commitment(commitment)
            .actorSubject(actor.subject())
            .actorName(actor.name())
            .fromStatus(fromStatus)
            .toStatus(toStatus)
            .changedFieldsJson(toJson(changedFields))
            .occurredAt(Instant.now())
            .build());
  }

  private Map<String, List<Object>> statusChange(
      CommitmentStatus fromStatus, CommitmentStatus toStatus) {
    Map<String, List<Object>> changedFields = new LinkedHashMap<>();
    addChange(changedFields, "status", fromStatus, toStatus);
    return changedFields;
  }

  private void addChange(
      Map<String, List<Object>> changedFields, String fieldName, Object before, Object after) {
    if ((before == null && after == null) || (before != null && before.equals(after))) {
      return;
    }
    changedFields.put(fieldName, Arrays.asList(before, after));
  }

  private String toJson(Map<String, List<Object>> changedFields) {
    try {
      return objectMapper.writeValueAsString(changedFields);
    } catch (JsonProcessingException exception) {
      throw new IllegalStateException("Could not serialize commitment audit event", exception);
    }
  }
}
