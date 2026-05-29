package com.st6.cadence.web;

import com.st6.cadence.domain.ChessLayer;
import com.st6.cadence.domain.CommitmentStatus;
import com.st6.cadence.domain.WeeklyCommitment;
import com.st6.cadence.repository.SupportingOutcomeRepository;
import com.st6.cadence.repository.WeeklyCommitmentRepository;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class WeeklyCommitmentController {
  private final WeeklyCommitmentRepository weeklyCommitmentRepository;
  private final SupportingOutcomeRepository supportingOutcomeRepository;

  public WeeklyCommitmentController(
      WeeklyCommitmentRepository weeklyCommitmentRepository,
      SupportingOutcomeRepository supportingOutcomeRepository) {
    this.weeklyCommitmentRepository = weeklyCommitmentRepository;
    this.supportingOutcomeRepository = supportingOutcomeRepository;
  }

  @GetMapping("/weekly-commitments/current")
  WeeklyCommitmentWeekResponse currentWeek() {
    LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);
    Page<WeeklyCommitment> page =
        weeklyCommitmentRepository.findByWeekStart(weekStart, PageRequest.of(0, 200));

    return new WeeklyCommitmentWeekResponse(
        weekStart, CommitmentStatus.DRAFT, page.map(CommitmentResponse::from).toList());
  }

  @PostMapping("/weekly-commitments")
  CommitmentResponse create(
      @AuthenticationPrincipal Jwt jwt, @RequestBody CreateCommitmentRequest createRequest) {
    var outcome =
        supportingOutcomeRepository.findById(createRequest.supportingOutcomeId()).orElseThrow();
    String subject = jwt.getSubject();
    String ownerName = jwt.getClaimAsString("name");
    LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);

    WeeklyCommitment commitment =
        WeeklyCommitment.builder()
            .supportingOutcome(outcome)
            .ownerSubject(subject)
            .ownerName(ownerName == null ? subject : ownerName)
            .title(createRequest.title())
            .plannedValue(createRequest.plannedValue())
            .status(CommitmentStatus.DRAFT)
            .chessLayer(createRequest.chessLayer())
            .weekStart(weekStart)
            .dueDate(createRequest.dueDate())
            .confidence(50)
            .build();

    return CommitmentResponse.from(weeklyCommitmentRepository.save(commitment));
  }

  @PutMapping("/weekly-commitments/{id}/reconciliation")
  CommitmentResponse reconcile(
      @PathVariable UUID id, @RequestBody ReconciliationRequest reconciliationRequest) {
    WeeklyCommitment commitment = weeklyCommitmentRepository.findById(id).orElseThrow();
    commitment.setActualValue(reconciliationRequest.actualValue());
    commitment.setStatus(
        reconciliationRequest.carryForward()
            ? CommitmentStatus.CARRIED_FORWARD
            : CommitmentStatus.RECONCILED);
    return CommitmentResponse.from(weeklyCommitmentRepository.save(commitment));
  }

  @GetMapping("/manager-dashboard/commitments")
  Page<CommitmentResponse> managerCommitments(Pageable pageable) {
    LocalDate weekStart = LocalDate.now().with(DayOfWeek.MONDAY);
    return weeklyCommitmentRepository
        .findByWeekStart(weekStart, pageable)
        .map(CommitmentResponse::from);
  }

  record WeeklyCommitmentWeekResponse(
      LocalDate weekStart, CommitmentStatus state, List<CommitmentResponse> commitments) {}

  record ReconciliationRequest(String actualValue, boolean carryForward) {}

  record CreateCommitmentRequest(
      String title,
      String plannedValue,
      UUID supportingOutcomeId,
      ChessLayer chessLayer,
      LocalDate dueDate) {}

  record CommitmentResponse(
      UUID id,
      String ownerName,
      String title,
      String plannedValue,
      String actualValue,
      CommitmentStatus status,
      String chessLayer,
      RcdoLink rcdo,
      LocalDate dueDate,
      int confidence) {
    static CommitmentResponse from(WeeklyCommitment commitment) {
      var outcome = commitment.getSupportingOutcome();
      var objective = outcome.getDefiningObjective();
      var rallyCry = objective.getRallyCry();

      return new CommitmentResponse(
          commitment.getId(),
          commitment.getOwnerName(),
          commitment.getTitle(),
          commitment.getPlannedValue(),
          commitment.getActualValue(),
          commitment.getStatus(),
          commitment.getChessLayer().name(),
          new RcdoLink(
              rallyCry.getTitle(), objective.getTitle(), outcome.getId(), outcome.getTitle()),
          commitment.getDueDate(),
          commitment.getConfidence());
    }
  }

  record RcdoLink(
      String rallyCry,
      String definingObjective,
      UUID supportingOutcomeId,
      String supportingOutcome) {}
}
