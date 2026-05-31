package com.st6.cadence.web;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.st6.cadence.config.SecurityConfig;
import com.st6.cadence.domain.ChessLayer;
import com.st6.cadence.domain.CommitmentRisk;
import com.st6.cadence.domain.CommitmentStatus;
import com.st6.cadence.domain.DefiningObjective;
import com.st6.cadence.domain.RallyCry;
import com.st6.cadence.domain.SupportingOutcome;
import com.st6.cadence.domain.WeeklyCommitment;
import com.st6.cadence.domain.WeeklyCommitmentWorkflow;
import com.st6.cadence.domain.WeeklyCommitmentWorkflow.CommitmentSignals;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WeeklyCommitmentController.class)
@Import(SecurityConfig.class)
class WeeklyCommitmentControllerTest {
  private static final UUID SUPPORTING_OUTCOME_ID =
      UUID.fromString("11111111-1111-4111-8111-111111111111");

  @Autowired private MockMvc mockMvc;

  @MockBean private WeeklyCommitmentWorkflow workflow;

  @BeforeEach
  void setUpSignals() {
    when(workflow.signalsFor(any(WeeklyCommitment.class)))
        .thenAnswer((invocation) -> CommitmentSignals.empty(invocation.getArgument(0)));
  }

  @Test
  void currentWeekReturnsDraftLifecycleWithCommitmentsArray() throws Exception {
    when(workflow.currentWeek(any(Pageable.class))).thenReturn(new PageImpl<>(List.of()));

    mockMvc
        .perform(get("/api/weekly-commitments/current").with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.state").value("DRAFT"))
        .andExpect(jsonPath("$.commitments", hasSize(0)));
  }

  @Test
  void createCommitmentRequiresRcdoOutcomeAndReturnsCreatedDraft() throws Exception {
    SupportingOutcome outcome = supportingOutcome();
    UUID commitmentId = UUID.fromString("33333333-3333-4333-8333-333333333333");
    WeeklyCommitment commitment =
        WeeklyCommitment.builder()
            .id(commitmentId)
            .supportingOutcome(outcome)
            .ownerSubject("auth0|st6-user")
            .ownerName("Mira Petrova")
            .title("Prepare Q2 operating partner cadence review")
            .plannedValue("Portfolio review pack ready for IC pre-read")
            .status(CommitmentStatus.DRAFT)
            .chessLayer(ChessLayer.QUEEN)
            .weekStart(LocalDate.parse("2026-06-01"))
            .dueDate(LocalDate.parse("2026-06-05"))
            .risk(CommitmentRisk.ON_TRACK)
            .build();

    when(workflow.create(any(), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(commitment);

    mockMvc
        .perform(
            post("/api/weekly-commitments")
                .with(
                    jwt()
                        .jwt(
                            (token) ->
                                token.subject("auth0|st6-user").claim("name", "Mira Petrova")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "title": "Prepare Q2 operating partner cadence review",
                      "plannedValue": "Portfolio review pack ready for IC pre-read",
                      "supportingOutcomeId": "11111111-1111-4111-8111-111111111111",
                      "chessLayer": "QUEEN",
                      "dueDate": "2026-06-05"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(commitmentId.toString()))
        .andExpect(jsonPath("$.ownerName").value("Mira Petrova"))
        .andExpect(jsonPath("$.status").value("DRAFT"))
        .andExpect(jsonPath("$.risk").value("ON_TRACK"))
        .andExpect(jsonPath("$.chessLayer").value(ChessLayer.QUEEN.name()))
        .andExpect(jsonPath("$.weeksCarried").value(0))
        .andExpect(jsonPath("$.originWeekStart").value("2026-06-01"))
        .andExpect(jsonPath("$.outcomeDeprioritized").value(false))
        .andExpect(jsonPath("$.auditEvents", hasSize(0)))
        .andExpect(jsonPath("$.rcdo.supportingOutcomeId").value(SUPPORTING_OUTCOME_ID.toString()));
  }

  @Test
  void getFlagsCommitmentsPointingAtArchivedOutcomesAfterLock() throws Exception {
    UUID commitmentId = UUID.fromString("33333333-3333-4333-8333-333333333333");
    WeeklyCommitment commitment = commitment(CommitmentStatus.LOCKED);
    commitment.setLockedAt(Instant.parse("2026-06-02T12:00:00Z"));
    commitment.getSupportingOutcome().setActive(false);
    commitment.getSupportingOutcome().setArchivedAt(Instant.parse("2026-06-03T12:00:00Z"));

    when(workflow.get(commitmentId)).thenReturn(commitment);

    mockMvc
        .perform(get("/api/weekly-commitments/{id}", commitmentId).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.outcomeDeprioritized").value(true))
        .andExpect(
            jsonPath("$.outcomeStatusNote")
                .value("Supporting outcome archived after commitment lock"));
  }

  @Test
  void managerReviewEndpointReturnsApprovedCommitment() throws Exception {
    UUID commitmentId = UUID.fromString("33333333-3333-4333-8333-333333333333");
    WeeklyCommitment commitment =
        WeeklyCommitment.builder()
            .id(commitmentId)
            .supportingOutcome(supportingOutcome())
            .ownerSubject("auth0|st6-user")
            .ownerName("Mira Petrova")
            .title("Prepare Q2 operating partner cadence review")
            .plannedValue("Portfolio review pack ready for IC pre-read")
            .status(CommitmentStatus.APPROVED)
            .managerSubject("auth0|director")
            .managerName("Rhea Patel")
            .reviewNote("Approved for the week")
            .chessLayer(ChessLayer.QUEEN)
            .weekStart(LocalDate.parse("2026-06-01"))
            .dueDate(LocalDate.parse("2026-06-05"))
            .risk(CommitmentRisk.ON_TRACK)
            .build();

    when(workflow.review(any(), any(), anyBoolean(), any())).thenReturn(commitment);

    mockMvc
        .perform(
            post("/api/weekly-commitments/{id}/review", commitmentId)
                .with(
                    jwt()
                        .jwt(
                            (token) ->
                                token
                                    .subject("auth0|director")
                                    .claim("name", "Rhea Patel")
                                    .claim("roles", List.of("DIRECTOR"))))
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "approved": true,
                      "reviewNote": "Approved for the week"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("APPROVED"))
        .andExpect(jsonPath("$.managerName").value("Rhea Patel"))
        .andExpect(jsonPath("$.reviewNote").value("Approved for the week"));
  }

  @Test
  void expandedLifecycleEndpointsDelegateToWorkflow() throws Exception {
    UUID commitmentId = UUID.fromString("33333333-3333-4333-8333-333333333333");
    when(workflow.get(commitmentId)).thenReturn(commitment(CommitmentStatus.DRAFT));
    when(workflow.update(any(), any(), any(), any(), any(), any(), any(), any(), any()))
        .thenReturn(commitment(CommitmentStatus.DRAFT));
    when(workflow.lock(any(), any())).thenReturn(commitment(CommitmentStatus.LOCKED));
    when(workflow.transition(any(), any(), any(), any(), any(), any()))
        .thenReturn(commitment(CommitmentStatus.RECONCILING));
    when(workflow.startReconciliation(any(), any()))
        .thenReturn(commitment(CommitmentStatus.RECONCILING));
    when(workflow.reconcile(any(), any(), any(), any(), anyBoolean()))
        .thenReturn(commitment(CommitmentStatus.RECONCILED));
    when(workflow.managerCommitments(any(), any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of(commitment(CommitmentStatus.LOCKED))));

    mockMvc
        .perform(get("/api/weekly-commitments/{id}", commitmentId).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DRAFT"));

    mockMvc
        .perform(
            put("/api/weekly-commitments/{id}", commitmentId)
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "title": "Updated commitment",
                      "plannedValue": "Updated planned value",
                      "supportingOutcomeId": "11111111-1111-4111-8111-111111111111",
                      "chessLayer": "ROOK",
                      "dueDate": "2026-06-06",
                      "risk": "AT_RISK",
                      "ownerName": "Avery Chen"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DRAFT"));

    mockMvc
        .perform(post("/api/weekly-commitments/{id}/lock", commitmentId).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("LOCKED"));

    mockMvc
        .perform(
            post("/api/weekly-commitments/{id}/transition", commitmentId)
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "targetStatus": "RECONCILING",
                      "actualValue": "Actual value",
                      "proof": "Proof note",
                      "reviewNote": "Review note"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("RECONCILING"));

    mockMvc
        .perform(
            post("/api/weekly-commitments/{id}/reconciliation/start", commitmentId).with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("RECONCILING"));

    mockMvc
        .perform(
            put("/api/weekly-commitments/{id}/reconciliation", commitmentId)
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "actualValue": "Review pack shipped",
                      "proof": "Proof note",
                      "carryForward": false
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("RECONCILED"));

    mockMvc
        .perform(get("/api/manager-dashboard/commitments").with(jwt()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.content", hasSize(1)));
  }

  @Test
  void carryForwardAndDashboardReviewEndpointsReturnWorkflowResponses() throws Exception {
    UUID commitmentId = UUID.fromString("33333333-3333-4333-8333-333333333333");
    when(workflow.carryForward(any(), any(), any(), any(), any()))
        .thenReturn(
            new com.st6.cadence.domain.CarryForwardResult(
                commitment(CommitmentStatus.CARRIED_FORWARD), commitment(CommitmentStatus.DRAFT)));
    when(workflow.review(any(), any(), anyBoolean(), any()))
        .thenReturn(commitment(CommitmentStatus.NEEDS_REVISION));

    mockMvc
        .perform(
            post("/api/weekly-commitments/{id}/carry-forward", commitmentId)
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "actualValue": "Dependency slipped",
                      "proof": "Customer note",
                      "dueDate": "2026-06-12"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.closedCommitment.status").value("CARRIED_FORWARD"))
        .andExpect(jsonPath("$.carriedForwardCommitment.status").value("DRAFT"));

    mockMvc
        .perform(
            put("/api/manager-dashboard/commitments/{id}/review", commitmentId)
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "decision": "NEEDS_OWNER_UPDATE",
                      "note": "Clarify blocker"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("NEEDS_REVISION"));
  }

  @Test
  void deleteAndErrorHandlersExposeOperationalSignals() throws Exception {
    UUID commitmentId = UUID.fromString("33333333-3333-4333-8333-333333333333");

    mockMvc
        .perform(delete("/api/weekly-commitments/{id}", commitmentId).with(jwt()))
        .andExpect(status().isNoContent());

    when(workflow.get(UUID.fromString("44444444-4444-4444-8444-444444444444")))
        .thenThrow(new NoSuchElementException("Commitment not found"));
    when(workflow.get(UUID.fromString("55555555-5555-4555-8555-555555555555")))
        .thenThrow(new IllegalArgumentException("Bad request"));
    when(workflow.get(UUID.fromString("66666666-6666-4666-8666-666666666666")))
        .thenThrow(new AccessDeniedException("Forbidden"));
    doThrow(new com.st6.cadence.domain.InvalidCommitmentTransitionException("Invalid transition"))
        .when(workflow)
        .delete(any(), any());

    mockMvc
        .perform(
            get("/api/weekly-commitments/{id}", "44444444-4444-4444-8444-444444444444").with(jwt()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.message").value("Commitment not found"));
    mockMvc
        .perform(
            get("/api/weekly-commitments/{id}", "55555555-5555-4555-8555-555555555555").with(jwt()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Bad request"));
    mockMvc
        .perform(
            get("/api/weekly-commitments/{id}", "66666666-6666-4666-8666-666666666666").with(jwt()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.message").value("Forbidden"));
    mockMvc
        .perform(
            delete("/api/weekly-commitments/{id}", "77777777-7777-4777-8777-777777777777")
                .with(jwt()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.message").value("Invalid transition"));
  }

  private WeeklyCommitment commitment(CommitmentStatus status) {
    return WeeklyCommitment.builder()
        .id(UUID.fromString("33333333-3333-4333-8333-333333333333"))
        .supportingOutcome(supportingOutcome())
        .ownerSubject("auth0|st6-user")
        .ownerName("Mira Petrova")
        .title("Prepare Q2 operating partner cadence review")
        .plannedValue("Portfolio review pack ready for IC pre-read")
        .actualValue(status == CommitmentStatus.RECONCILED ? "Review pack shipped" : null)
        .status(status)
        .managerSubject("auth0|director")
        .managerName("Rhea Patel")
        .reviewNote("Review note")
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
}
