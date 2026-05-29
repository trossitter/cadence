package com.st6.cadence.web;

import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.st6.cadence.config.SecurityConfig;
import com.st6.cadence.domain.ChessLayer;
import com.st6.cadence.domain.DefiningObjective;
import com.st6.cadence.domain.RallyCry;
import com.st6.cadence.domain.SupportingOutcome;
import com.st6.cadence.domain.WeeklyCommitment;
import com.st6.cadence.repository.SupportingOutcomeRepository;
import com.st6.cadence.repository.WeeklyCommitmentRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(WeeklyCommitmentController.class)
@Import(SecurityConfig.class)
class WeeklyCommitmentControllerTest {
  private static final UUID SUPPORTING_OUTCOME_ID =
      UUID.fromString("11111111-1111-4111-8111-111111111111");

  @Autowired private MockMvc mockMvc;

  @MockBean private WeeklyCommitmentRepository weeklyCommitmentRepository;

  @MockBean private SupportingOutcomeRepository supportingOutcomeRepository;

  @Test
  void currentWeekReturnsDraftLifecycleWithCommitmentsArray() throws Exception {
    when(weeklyCommitmentRepository.findByWeekStart(any(LocalDate.class), any(Pageable.class)))
        .thenReturn(new PageImpl<>(List.of()));

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

    when(supportingOutcomeRepository.findById(SUPPORTING_OUTCOME_ID))
        .thenReturn(Optional.of(outcome));
    when(weeklyCommitmentRepository.save(any(WeeklyCommitment.class)))
        .thenAnswer(
            invocation -> {
              WeeklyCommitment commitment = invocation.getArgument(0);
              commitment.setId(commitmentId);
              return commitment;
            });

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
        .andExpect(jsonPath("$.chessLayer").value(ChessLayer.QUEEN.name()))
        .andExpect(jsonPath("$.rcdo.supportingOutcomeId").value(SUPPORTING_OUTCOME_ID.toString()));
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
