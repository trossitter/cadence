package com.st6.cadence.web;

import com.st6.cadence.domain.CarryForwardResult;
import com.st6.cadence.domain.ChessLayer;
import com.st6.cadence.domain.CommitmentActor;
import com.st6.cadence.domain.CommitmentAuditEvent;
import com.st6.cadence.domain.CommitmentRisk;
import com.st6.cadence.domain.CommitmentStatus;
import com.st6.cadence.domain.InvalidCommitmentTransitionException;
import com.st6.cadence.domain.WeeklyCommitment;
import com.st6.cadence.domain.WeeklyCommitmentWorkflow;
import com.st6.cadence.domain.WeeklyCommitmentWorkflow.CommitmentSignals;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WeeklyCommitmentController {
  private final WeeklyCommitmentWorkflow workflow;

  public WeeklyCommitmentController(WeeklyCommitmentWorkflow workflow) {
    this.workflow = workflow;
  }

  @GetMapping("/weekly-commitments/current")
  WeeklyCommitmentWeekResponse currentWeek() {
    LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);
    Page<WeeklyCommitment> page = workflow.currentWeek(PageRequest.of(0, 200));
    List<CommitmentResponse> commitments = page.map(this::response).toList();

    return new WeeklyCommitmentWeekResponse(weekStart, weekState(commitments), commitments);
  }

  @GetMapping("/weekly-commitments")
  Page<CommitmentResponse> weeklyCommitments(
      @RequestParam(required = false) CommitmentStatus status, Pageable pageable) {
    return workflow.managerCommitments(status, pageable).map(this::response);
  }

  @GetMapping("/weekly-commitments/{id}")
  CommitmentResponse get(@PathVariable UUID id) {
    return response(workflow.get(id));
  }

  @PostMapping("/weekly-commitments")
  CommitmentResponse create(
      @AuthenticationPrincipal Jwt jwt, @RequestBody CreateCommitmentRequest createRequest) {
    return response(
        workflow.create(
            actorFrom(jwt),
            createRequest.supportingOutcomeId(),
            createRequest.title(),
            createRequest.plannedValue(),
            createRequest.chessLayer(),
            createRequest.dueDate(),
            createRequest.risk(),
            createRequest.ownerName()));
  }

  @PutMapping("/weekly-commitments/{id}")
  CommitmentResponse update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody UpdateCommitmentRequest updateRequest) {
    return response(
        workflow.update(
            actorFrom(jwt),
            id,
            updateRequest.supportingOutcomeId(),
            updateRequest.title(),
            updateRequest.plannedValue(),
            updateRequest.chessLayer(),
            updateRequest.dueDate(),
            updateRequest.risk(),
            updateRequest.ownerName()));
  }

  @DeleteMapping("/weekly-commitments/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void delete(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    workflow.delete(actorFrom(jwt), id);
  }

  @PostMapping("/weekly-commitments/{id}/lock")
  CommitmentResponse lock(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return response(workflow.lock(actorFrom(jwt), id));
  }

  @PostMapping("/weekly-commitments/current/lock")
  WeeklyCommitmentWeekResponse lockCurrentWeek(@AuthenticationPrincipal Jwt jwt) {
    CommitmentActor actor = actorFrom(jwt);
    Page<WeeklyCommitment> page = workflow.currentWeek(PageRequest.of(0, 200));

    for (WeeklyCommitment commitment : page) {
      if (commitment.getStatus() == CommitmentStatus.DRAFT
          || commitment.getStatus() == CommitmentStatus.NEEDS_REVISION) {
        workflow.lock(actor, commitment.getId());
      }
    }

    return currentWeek();
  }

  @PostMapping("/weekly-commitments/{id}/transition")
  CommitmentResponse transition(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody TransitionRequest transitionRequest) {
    return response(
        workflow.transition(
            actorFrom(jwt),
            id,
            transitionRequest.targetStatus(),
            transitionRequest.actualValue(),
            transitionRequest.proof(),
            transitionRequest.reviewNote()));
  }

  @PostMapping("/weekly-commitments/{id}/review")
  CommitmentResponse review(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody ManagerReviewRequest reviewRequest) {
    return response(
        workflow.review(actorFrom(jwt), id, reviewRequest.approved(), reviewRequest.reviewNote()));
  }

  @PutMapping("/manager-dashboard/commitments/{id}/review")
  CommitmentResponse dashboardReview(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody ManagerDashboardReviewRequest reviewRequest) {
    boolean approved = reviewRequest.decision() == ManagerReviewDecision.APPROVED;
    return response(workflow.review(actorFrom(jwt), id, approved, reviewRequest.note()));
  }

  @PostMapping("/weekly-commitments/{id}/reconciliation/start")
  CommitmentResponse startReconciliation(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return response(workflow.startReconciliation(actorFrom(jwt), id));
  }

  @PutMapping("/weekly-commitments/{id}/reconciliation")
  CommitmentResponse reconcile(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody ReconciliationRequest reconciliationRequest) {
    if (reconciliationRequest.carryForward()) {
      CarryForwardResult result =
          workflow.carryForward(
              actorFrom(jwt),
              id,
              reconciliationRequest.actualValue(),
              reconciliationRequest.proof(),
              reconciliationRequest.dueDate());
      return response(result.closedCommitment());
    }
    return response(
        workflow.reconcile(
            actorFrom(jwt),
            id,
            reconciliationRequest.actualValue(),
            reconciliationRequest.proof(),
            false));
  }

  @PostMapping("/weekly-commitments/{id}/carry-forward")
  CarryForwardResponse carryForward(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable UUID id,
      @RequestBody CarryForwardRequest carryForwardRequest) {
    CarryForwardResult result =
        workflow.carryForward(
            actorFrom(jwt),
            id,
            carryForwardRequest.actualValue(),
            carryForwardRequest.proof(),
            carryForwardRequest.dueDate());
    return new CarryForwardResponse(
        response(result.closedCommitment()), response(result.carriedForwardCommitment()));
  }

  @GetMapping("/manager-dashboard/commitments")
  Page<CommitmentResponse> managerCommitments(
      @RequestParam(required = false) CommitmentStatus status, Pageable pageable) {
    return workflow.managerCommitments(status, pageable).map(this::response);
  }

  record WeeklyCommitmentWeekResponse(
      LocalDate weekStart, CommitmentStatus state, List<CommitmentResponse> commitments) {}

  record ReconciliationRequest(
      String actualValue, String proof, boolean carryForward, LocalDate dueDate) {}

  record CreateCommitmentRequest(
      String title,
      String plannedValue,
      UUID supportingOutcomeId,
      ChessLayer chessLayer,
      LocalDate dueDate,
      CommitmentRisk risk,
      String ownerName) {}

  record UpdateCommitmentRequest(
      String title,
      String plannedValue,
      UUID supportingOutcomeId,
      ChessLayer chessLayer,
      LocalDate dueDate,
      CommitmentRisk risk,
      String ownerName) {}

  record TransitionRequest(
      CommitmentStatus targetStatus, String actualValue, String proof, String reviewNote) {}

  record ManagerReviewRequest(boolean approved, String reviewNote) {}

  enum ManagerReviewDecision {
    APPROVED,
    NEEDS_OWNER_UPDATE,
    ESCALATED
  }

  record ManagerDashboardReviewRequest(ManagerReviewDecision decision, String note) {}

  record CarryForwardRequest(String actualValue, String proof, LocalDate dueDate) {}

  record CarryForwardResponse(
      CommitmentResponse closedCommitment, CommitmentResponse carriedForwardCommitment) {
    static CarryForwardResponse from(CarryForwardResult result) {
      return new CarryForwardResponse(
          CommitmentResponse.from(
              result.closedCommitment(), CommitmentSignals.empty(result.closedCommitment())),
          CommitmentResponse.from(
              result.carriedForwardCommitment(),
              CommitmentSignals.empty(result.carriedForwardCommitment())));
    }
  }

  record CommitmentResponse(
      UUID id,
      String ownerName,
      String title,
      String plannedValue,
      String actualValue,
      String proof,
      CommitmentStatus status,
      String chessLayer,
      RcdoLink rcdo,
      LocalDate weekStart,
      LocalDate dueDate,
      CommitmentRisk risk,
      String managerName,
      String reviewNote,
      Instant lockedAt,
      Instant reviewedAt,
      Instant reconciledAt,
      UUID carriedForwardFromId,
      int weeksCarried,
      LocalDate originWeekStart,
      boolean outcomeDeprioritized,
      String outcomeStatusNote,
      List<CommitmentAuditEventResponse> auditEvents) {
    static CommitmentResponse from(WeeklyCommitment commitment, CommitmentSignals signals) {
      var outcome = commitment.getSupportingOutcome();
      var objective = outcome.getDefiningObjective();
      var rallyCry = objective.getRallyCry();
      String outcomeStatusNote = outcomeStatusNote(commitment, outcome, rallyCry);

      return new CommitmentResponse(
          commitment.getId(),
          commitment.getOwnerName(),
          commitment.getTitle(),
          commitment.getPlannedValue(),
          commitment.getActualValue(),
          commitment.getProof(),
          commitment.getStatus(),
          commitment.getChessLayer().name(),
          new RcdoLink(
              rallyCry.getTitle(), objective.getTitle(), outcome.getId(), outcome.getTitle()),
          commitment.getWeekStart(),
          commitment.getDueDate(),
          commitment.getRisk(),
          commitment.getManagerName(),
          commitment.getReviewNote(),
          commitment.getLockedAt(),
          commitment.getReviewedAt(),
          commitment.getReconciledAt(),
          commitment.getCarriedForwardFromId(),
          signals.weeksCarried(),
          signals.originWeekStart(),
          outcomeStatusNote != null,
          outcomeStatusNote,
          signals.auditEvents().stream().map(CommitmentAuditEventResponse::from).toList());
    }

    private static String outcomeStatusNote(
        WeeklyCommitment commitment,
        com.st6.cadence.domain.SupportingOutcome outcome,
        com.st6.cadence.domain.RallyCry rallyCry) {
      Instant reference =
          commitment.getLockedAt() == null ? commitment.getCreatedAt() : commitment.getLockedAt();

      if (reference == null) {
        reference = Instant.EPOCH;
      }

      if (archivedAfterCommitmentReference(
          outcome.isActive(), outcome.getArchivedAt(), reference)) {
        return "Supporting outcome archived after commitment lock";
      }

      if (archivedAfterCommitmentReference(
          rallyCry.isActive(), rallyCry.getArchivedAt(), reference)) {
        return "Rally Cry archived after commitment lock";
      }

      return null;
    }

    private static boolean archivedAfterCommitmentReference(
        boolean active, Instant archivedAt, Instant reference) {
      return !active && archivedAt != null && archivedAt.isAfter(reference);
    }
  }

  record CommitmentAuditEventResponse(
      UUID id,
      String actorName,
      CommitmentStatus fromStatus,
      CommitmentStatus toStatus,
      String changedFields,
      Instant occurredAt) {
    static CommitmentAuditEventResponse from(CommitmentAuditEvent event) {
      return new CommitmentAuditEventResponse(
          event.getId(),
          event.getActorName(),
          event.getFromStatus(),
          event.getToStatus(),
          event.getChangedFieldsJson(),
          event.getOccurredAt());
    }
  }

  record RcdoLink(
      String rallyCry,
      String definingObjective,
      UUID supportingOutcomeId,
      String supportingOutcome) {}

  record ErrorResponse(String message) {}

  @ResponseStatus(HttpStatus.NOT_FOUND)
  @ExceptionHandler(NoSuchElementException.class)
  ErrorResponse notFound(RuntimeException exception) {
    return new ErrorResponse(exception.getMessage());
  }

  @ResponseStatus(HttpStatus.CONFLICT)
  @ExceptionHandler(InvalidCommitmentTransitionException.class)
  ErrorResponse invalidTransition(RuntimeException exception) {
    return new ErrorResponse(exception.getMessage());
  }

  @ResponseStatus(HttpStatus.BAD_REQUEST)
  @ExceptionHandler(IllegalArgumentException.class)
  ErrorResponse badRequest(RuntimeException exception) {
    return new ErrorResponse(exception.getMessage());
  }

  @ResponseStatus(HttpStatus.FORBIDDEN)
  @ExceptionHandler(AccessDeniedException.class)
  ErrorResponse forbidden(RuntimeException exception) {
    return new ErrorResponse(exception.getMessage());
  }

  private CommitmentActor actorFrom(Jwt jwt) {
    if (jwt == null) {
      return new CommitmentActor("local-demo-user", "Local Demo User", true);
    }

    String subject = jwt.getSubject();
    String name = jwt.getClaimAsString("name");
    return new CommitmentActor(
        subject == null ? "local-demo-user" : subject,
        name == null ? subject : name,
        hasManagerRole(jwt));
  }

  private CommitmentResponse response(WeeklyCommitment commitment) {
    return CommitmentResponse.from(commitment, workflow.signalsFor(commitment));
  }

  private boolean hasManagerRole(Jwt jwt) {
    Set<String> roles = new HashSet<>();
    addClaimValues(jwt.getClaim("roles"), roles);
    addClaimValues(jwt.getClaim("role"), roles);
    addClaimValues(jwt.getClaim("authorities"), roles);
    addClaimValues(jwt.getClaim("permissions"), roles);
    addClaimValues(jwt.getClaim("scope"), roles);

    Object realmAccess = jwt.getClaim("realm_access");
    if (realmAccess instanceof Map<?, ?> access) {
      addClaimValues(access.get("roles"), roles);
    }

    return roles.stream()
        .map((role) -> role.toLowerCase(Locale.ROOT))
        .anyMatch(
            (role) ->
                role.equals("admin")
                    || role.equals("manager")
                    || role.equals("director")
                    || role.endsWith(":manager")
                    || role.endsWith(":director"));
  }

  private void addClaimValues(Object rawValue, Set<String> roles) {
    if (rawValue instanceof Collection<?> values) {
      values.forEach((value) -> addClaimValues(value, roles));
      return;
    }
    if (rawValue instanceof String text) {
      for (String role : text.split("[,\\s]+")) {
        if (!role.isBlank()) {
          roles.add(role);
        }
      }
      return;
    }
    if (rawValue != null) {
      roles.add(rawValue.toString());
    }
  }

  private CommitmentStatus weekState(List<CommitmentResponse> commitments) {
    if (commitments.isEmpty()) {
      return CommitmentStatus.DRAFT;
    }
    if (commitments.stream()
        .anyMatch((commitment) -> commitment.status() == CommitmentStatus.LOCKED)) {
      return CommitmentStatus.LOCKED;
    }
    if (commitments.stream()
        .anyMatch((commitment) -> commitment.status() == CommitmentStatus.NEEDS_REVISION)) {
      return CommitmentStatus.NEEDS_REVISION;
    }
    if (commitments.stream()
        .anyMatch((commitment) -> commitment.status() == CommitmentStatus.RECONCILING)) {
      return CommitmentStatus.RECONCILING;
    }
    if (commitments.stream()
        .anyMatch((commitment) -> commitment.status() == CommitmentStatus.APPROVED)) {
      return CommitmentStatus.APPROVED;
    }
    if (commitments.stream()
        .allMatch((commitment) -> commitment.status() == CommitmentStatus.CARRIED_FORWARD)) {
      return CommitmentStatus.CARRIED_FORWARD;
    }
    if (commitments.stream()
        .allMatch(
            (commitment) ->
                commitment.status() == CommitmentStatus.RECONCILED
                    || commitment.status() == CommitmentStatus.CARRIED_FORWARD)) {
      return CommitmentStatus.RECONCILED;
    }
    return CommitmentStatus.DRAFT;
  }
}
