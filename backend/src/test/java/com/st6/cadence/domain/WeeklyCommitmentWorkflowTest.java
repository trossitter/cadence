package com.st6.cadence.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.st6.cadence.repository.CommitmentAuditEventRepository;
import com.st6.cadence.repository.SupportingOutcomeRepository;
import com.st6.cadence.repository.WeeklyCommitmentRepository;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;

@ExtendWith(MockitoExtension.class)
class WeeklyCommitmentWorkflowTest {
  private static final UUID COMMITMENT_ID = UUID.fromString("33333333-3333-4333-8333-333333333333");
  private static final UUID SUPPORTING_OUTCOME_ID =
      UUID.fromString("11111111-1111-4111-8111-111111111111");

  @Mock private WeeklyCommitmentRepository weeklyCommitmentRepository;

  @Mock private SupportingOutcomeRepository supportingOutcomeRepository;

  @Mock private CommitmentAuditEventRepository commitmentAuditEventRepository;

  private WeeklyCommitmentWorkflow workflow;

  @BeforeEach
  void setUp() {
    workflow =
        new WeeklyCommitmentWorkflow(
            weeklyCommitmentRepository,
            supportingOutcomeRepository,
            commitmentAuditEventRepository,
            new ObjectMapper());
    lenient()
        .when(weeklyCommitmentRepository.save(any(WeeklyCommitment.class)))
        .thenAnswer((invocation) -> invocation.getArgument(0));
    lenient()
        .when(commitmentAuditEventRepository.save(any(CommitmentAuditEvent.class)))
        .thenAnswer((invocation) -> invocation.getArgument(0));
  }

  @Test
  void lockApproveAndReconcileFollowsValidLifecycle() {
    WeeklyCommitment commitment = commitment(CommitmentStatus.DRAFT);
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment));

    WeeklyCommitment locked = workflow.lock(contributor(), COMMITMENT_ID);
    assertThat(locked.getStatus()).isEqualTo(CommitmentStatus.LOCKED);
    assertThat(locked.getLockedAt()).isNotNull();

    ArgumentCaptor<CommitmentAuditEvent> auditEvent =
        ArgumentCaptor.forClass(CommitmentAuditEvent.class);
    verify(commitmentAuditEventRepository).save(auditEvent.capture());
    assertThat(auditEvent.getValue().getFromStatus()).isEqualTo(CommitmentStatus.DRAFT);
    assertThat(auditEvent.getValue().getToStatus()).isEqualTo(CommitmentStatus.LOCKED);
    assertThat(auditEvent.getValue().getChangedFieldsJson()).contains("\"status\"");

    WeeklyCommitment approved =
        workflow.review(director(), COMMITMENT_ID, true, "Approved for the week");
    assertThat(approved.getStatus()).isEqualTo(CommitmentStatus.APPROVED);
    assertThat(approved.getManagerName()).isEqualTo("Rhea Patel");

    WeeklyCommitment reconciling = workflow.startReconciliation(contributor(), COMMITMENT_ID);
    assertThat(reconciling.getStatus()).isEqualTo(CommitmentStatus.RECONCILING);

    WeeklyCommitment reconciled =
        workflow.reconcile(
            contributor(), COMMITMENT_ID, "Review pack shipped", "https://proof", false);
    assertThat(reconciled.getStatus()).isEqualTo(CommitmentStatus.RECONCILED);
    assertThat(reconciled.getActualValue()).isEqualTo("Review pack shipped");
    assertThat(reconciled.getProof()).isEqualTo("https://proof");
    assertThat(reconciled.getReconciledAt()).isNotNull();
  }

  @Test
  void rejectsReconciliationBeforeApproval() {
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment(CommitmentStatus.DRAFT)));

    assertThatThrownBy(
            () ->
                workflow.reconcile(
                    contributor(), COMMITMENT_ID, "Review pack shipped", "https://proof", false))
        .isInstanceOf(InvalidCommitmentTransitionException.class)
        .hasMessageContaining("DRAFT to RECONCILED");
  }

  @Test
  void reviewRequiresManagerOrDirectorActor() {
    assertThatThrownBy(
            () -> workflow.review(contributor(), COMMITMENT_ID, true, "Approved for the week"))
        .isInstanceOf(AccessDeniedException.class)
        .hasMessageContaining("manager or director");
  }

  @Test
  void managerCannotApproveBeforeContributorLocksCommitment() {
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment(CommitmentStatus.DRAFT)));

    assertThatThrownBy(
            () -> workflow.review(director(), COMMITMENT_ID, true, "Approved for the week"))
        .isInstanceOf(InvalidCommitmentTransitionException.class)
        .hasMessageContaining("DRAFT to APPROVED");
  }

  @Test
  void carryForwardClosesOriginalAndCreatesNextDraftWithRcdoLink() {
    WeeklyCommitment commitment = commitment(CommitmentStatus.APPROVED);
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment));

    CarryForwardResult result =
        workflow.carryForward(
            contributor(),
            COMMITMENT_ID,
            "Dependency slipped",
            "Customer email attached",
            LocalDate.parse("2026-06-12"));

    assertThat(result.closedCommitment().getStatus()).isEqualTo(CommitmentStatus.CARRIED_FORWARD);
    assertThat(result.closedCommitment().getActualValue()).isEqualTo("Dependency slipped");
    assertThat(result.closedCommitment().getProof()).isEqualTo("Customer email attached");

    WeeklyCommitment next = result.carriedForwardCommitment();
    assertThat(next.getStatus()).isEqualTo(CommitmentStatus.DRAFT);
    assertThat(next.getCarriedForwardFromId()).isEqualTo(COMMITMENT_ID);
    assertThat(next.getSupportingOutcome().getId()).isEqualTo(SUPPORTING_OUTCOME_ID);
    assertThat(next.getWeekStart()).isEqualTo(commitment.getWeekStart().plusWeeks(1));
    assertThat(next.getDueDate()).isEqualTo(LocalDate.parse("2026-06-12"));

    ArgumentCaptor<WeeklyCommitment> saved = ArgumentCaptor.forClass(WeeklyCommitment.class);
    verify(weeklyCommitmentRepository, times(2)).save(saved.capture());
    assertThat(saved.getAllValues()).hasSize(2);
    assertThat(saved.getAllValues().get(0)).isSameAs(commitment);
    assertThat(saved.getAllValues().get(1)).isSameAs(next);
  }

  @Test
  void updateNeedsRevisionReturnsCommitmentToDraftAndCanKeepRcdoLink() {
    WeeklyCommitment commitment = commitment(CommitmentStatus.NEEDS_REVISION);
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment));

    WeeklyCommitment updated =
        workflow.update(
            contributor(),
            COMMITMENT_ID,
            null,
            "Revise Q2 operating partner cadence review",
            "Updated pack ready for IC pre-read",
            null,
            null,
            CommitmentRisk.AT_RISK,
            null);

    assertThat(updated.getStatus()).isEqualTo(CommitmentStatus.DRAFT);
    assertThat(updated.getTitle()).isEqualTo("Revise Q2 operating partner cadence review");
    assertThat(updated.getPlannedValue()).isEqualTo("Updated pack ready for IC pre-read");
    assertThat(updated.getRisk()).isEqualTo(CommitmentRisk.AT_RISK);
    assertThat(updated.getSupportingOutcome().getId()).isEqualTo(SUPPORTING_OUTCOME_ID);
  }

  @Test
  void createUsesRequestedOwnerNameAndValidatesRequiredFields() {
    when(supportingOutcomeRepository.findById(SUPPORTING_OUTCOME_ID))
        .thenReturn(Optional.of(supportingOutcome()));

    WeeklyCommitment created =
        workflow.create(
            contributor(),
            SUPPORTING_OUTCOME_ID,
            "Publish operating digest",
            "Digest is sent before partner review",
            ChessLayer.ROOK,
            LocalDate.parse("2026-06-05"),
            CommitmentRisk.AT_RISK,
            "Avery Chen");

    assertThat(created.getStatus()).isEqualTo(CommitmentStatus.DRAFT);
    assertThat(created.getOwnerName()).isEqualTo("Avery Chen");
    assertThat(created.getOwnerSubject()).isEqualTo("auth0|st6-user");
    assertThat(created.getRisk()).isEqualTo(CommitmentRisk.AT_RISK);
    assertThat(created.getSupportingOutcome().getId()).isEqualTo(SUPPORTING_OUTCOME_ID);

    assertThatThrownBy(
            () ->
                workflow.create(
                    contributor(),
                    SUPPORTING_OUTCOME_ID,
                    " ",
                    "Digest is sent before partner review",
                    ChessLayer.ROOK,
                    LocalDate.parse("2026-06-05"),
                    CommitmentRisk.ON_TRACK,
                    "Avery Chen"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("title is required");
  }

  @Test
  void readsCurrentWeekManagerPagesAndSingleCommitmentWithRcdoGraph() {
    WeeklyCommitment commitment = commitment(CommitmentStatus.LOCKED);
    when(weeklyCommitmentRepository.findByWeekStart(any(LocalDate.class), any()))
        .thenReturn(new PageImpl<>(java.util.List.of(commitment)));
    when(weeklyCommitmentRepository.findByWeekStartAndStatus(
            any(LocalDate.class), any(CommitmentStatus.class), any()))
        .thenReturn(new PageImpl<>(java.util.List.of(commitment)));
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment));

    assertThat(workflow.currentWeek(PageRequest.of(0, 10))).containsExactly(commitment);
    assertThat(workflow.managerCommitments(null, PageRequest.of(0, 10)))
        .containsExactly(commitment);
    assertThat(workflow.managerCommitments(CommitmentStatus.LOCKED, PageRequest.of(0, 10)))
        .containsExactly(commitment);
    assertThat(workflow.get(COMMITMENT_ID)).isSameAs(commitment);
  }

  @Test
  void signalsExposeCarryDepthOriginWeekAndAuditEvents() {
    UUID originId = UUID.fromString("99999999-9999-4999-8999-999999999999");
    UUID middleId = UUID.fromString("88888888-8888-4888-8888-888888888888");
    UUID currentId = UUID.fromString("77777777-7777-4777-8777-777777777777");
    WeeklyCommitment origin = commitment(CommitmentStatus.CARRIED_FORWARD);
    origin.setId(originId);
    origin.setWeekStart(LocalDate.parse("2026-05-18"));
    WeeklyCommitment middle = commitment(CommitmentStatus.CARRIED_FORWARD);
    middle.setId(middleId);
    middle.setWeekStart(LocalDate.parse("2026-05-25"));
    middle.setCarriedForwardFromId(originId);
    WeeklyCommitment current = commitment(CommitmentStatus.DRAFT);
    current.setId(currentId);
    current.setWeekStart(LocalDate.parse("2026-06-01"));
    current.setCarriedForwardFromId(middleId);
    CommitmentAuditEvent event =
        CommitmentAuditEvent.builder()
            .commitment(current)
            .actorSubject("auth0|st6-user")
            .actorName("Mira Petrova")
            .toStatus(CommitmentStatus.DRAFT)
            .changedFieldsJson("{}")
            .occurredAt(java.time.Instant.parse("2026-06-01T12:00:00Z"))
            .build();

    when(weeklyCommitmentRepository.findByIdWithRcdo(middleId)).thenReturn(Optional.of(middle));
    when(weeklyCommitmentRepository.findByIdWithRcdo(originId)).thenReturn(Optional.of(origin));
    when(commitmentAuditEventRepository.findByCommitmentIdOrderByOccurredAtAsc(currentId))
        .thenReturn(java.util.List.of(event));

    WeeklyCommitmentWorkflow.CommitmentSignals signals = workflow.signalsFor(current);

    assertThat(signals.weeksCarried()).isEqualTo(2);
    assertThat(signals.originWeekStart()).isEqualTo(LocalDate.parse("2026-05-18"));
    assertThat(signals.auditEvents()).containsExactly(event);
  }

  @Test
  void deleteRequiresEditableOwnedCommitment() {
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment(CommitmentStatus.DRAFT)));

    workflow.delete(contributor(), COMMITMENT_ID);

    verify(weeklyCommitmentRepository).delete(any(WeeklyCommitment.class));

    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment(CommitmentStatus.LOCKED)));

    assertThatThrownBy(() -> workflow.delete(contributor(), COMMITMENT_ID))
        .isInstanceOf(InvalidCommitmentTransitionException.class)
        .hasMessageContaining("draft or awaiting revision");
  }

  @Test
  void rejectsUnauthorizedOwner() {
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(commitment(CommitmentStatus.DRAFT)));

    assertThatThrownBy(
            () ->
                workflow.update(
                    new CommitmentActor("auth0|other-user", "Other User", false),
                    COMMITMENT_ID,
                    null,
                    "Updated",
                    "Updated value",
                    null,
                    null,
                    CommitmentRisk.ON_TRACK,
                    null))
        .isInstanceOf(AccessDeniedException.class)
        .hasMessageContaining("Only the owner");
  }

  @Test
  void genericTransitionDispatchesRevisionAndCarryForwardPaths() {
    WeeklyCommitment needsRevision = commitment(CommitmentStatus.NEEDS_REVISION);
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(needsRevision));

    WeeklyCommitment draft =
        workflow.transition(contributor(), COMMITMENT_ID, CommitmentStatus.DRAFT, null, null, null);
    assertThat(draft.getStatus()).isEqualTo(CommitmentStatus.DRAFT);

    WeeklyCommitment approved = commitment(CommitmentStatus.APPROVED);
    when(weeklyCommitmentRepository.findByIdWithRcdo(COMMITMENT_ID))
        .thenReturn(Optional.of(approved));

    WeeklyCommitment carried =
        workflow.transition(
            contributor(),
            COMMITMENT_ID,
            CommitmentStatus.CARRIED_FORWARD,
            "Dependency slipped",
            "Proof note",
            null);
    assertThat(carried.getStatus()).isEqualTo(CommitmentStatus.CARRIED_FORWARD);
    assertThat(carried.getActualValue()).isEqualTo("Dependency slipped");
  }

  private WeeklyCommitment commitment(CommitmentStatus status) {
    return WeeklyCommitment.builder()
        .id(COMMITMENT_ID)
        .supportingOutcome(supportingOutcome())
        .ownerSubject("auth0|st6-user")
        .ownerName("Mira Petrova")
        .title("Prepare Q2 operating partner cadence review")
        .plannedValue("Portfolio review pack ready for IC pre-read")
        .status(status)
        .chessLayer(ChessLayer.QUEEN)
        .weekStart(LocalDate.parse("2026-06-01"))
        .dueDate(LocalDate.parse("2026-06-05"))
        .risk(CommitmentRisk.ON_TRACK)
        .build();
  }

  private SupportingOutcome supportingOutcome() {
    RallyCry rallyCry =
        RallyCry.builder()
            .id(UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))
            .title("Raise portfolio operating velocity")
            .build();
    DefiningObjective objective =
        DefiningObjective.builder()
            .id(UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc"))
            .rallyCry(rallyCry)
            .title("Standardize weekly execution signals")
            .build();
    return SupportingOutcome.builder()
        .id(SUPPORTING_OUTCOME_ID)
        .definingObjective(objective)
        .title("Every priority commitment maps to an RCDO outcome")
        .build();
  }

  private CommitmentActor contributor() {
    return new CommitmentActor("auth0|st6-user", "Mira Petrova", false);
  }

  private CommitmentActor director() {
    return new CommitmentActor("auth0|director", "Rhea Patel", true);
  }
}
