# Cadence Architecture

Cadence is a weekly execution system for ST6 Partners. The product replaces disconnected 15Five-style weekly plans with a workflow where commitments, manager review, reconciliation, and carry-forward decisions are all tied to the RCDO hierarchy.

The important idea is simple: a weekly commitment is not accepted unless it points to a Supporting Outcome. That makes weekly execution visible at the same level where strategy is already managed.

## Product Shape

Cadence has two primary views.

- Director view: team alignment, risk triage, weekly state controls, manager review, and RCDO coverage.
- Contributor view: personal weekly commitments, RCDO-linked creation, execution notes, reconciliation, and carry-forward requests.

Both views use the same data model. The difference is permission, scope, and default workflow.

## Current Repository State

The repository currently proves the following pieces.

- React 18 micro-frontend remote under `apps/wc`.
- Vite Module Federation remote named `cadence`, exposing `./CadenceApp`.
- RTK Query API layer for current week, create commitment, reconciliation, and manager dashboard calls.
- Spring Boot 3.3 backend under `backend`.
- PostgreSQL/Flyway schema for RCDO hierarchy and weekly commitments.
- Auth0 resource-server shape on the backend.
- Audited JPA entities.
- Unit, E2E, backend, coverage, Spotless, and SpotBugs checks.

The repository does not yet prove the whole product workflow. The largest missing slice is real end-to-end weekly operations: create, assign, lock, reconcile, review, carry forward, and explain the alignment impact.

## Target System

```mermaid
flowchart LR
  subgraph Host["PA Host App"]
    Shell["Existing application shell"]
    Auth["Auth0 session"]
  end

  subgraph Remote["Cadence MFE"]
    Toggle["Director / Contributor view switch"]
    Planner["Weekly planning workspace"]
    Review["Manager review dashboard"]
    ApiClient["RTK Query API client"]
  end

  subgraph Api["Cadence API"]
    Controller["WeeklyCommitmentController"]
    Workflow["Lifecycle service"]
    Policy["Authorization policy"]
    Repo["Spring Data repositories"]
  end

  subgraph Data["PostgreSQL"]
    RCDO["Rally Cry / Defining Objective / Supporting Outcome"]
    Commitments["Weekly commitments"]
    Reviews["Review and reconciliation events"]
  end

  Shell --> Remote
  Auth --> ApiClient
  Planner --> ApiClient
  Review --> ApiClient
  ApiClient --> Controller
  Controller --> Policy
  Controller --> Workflow
  Workflow --> Repo
  Repo --> Data
```

## Weekly Lifecycle

The lifecycle should be enforced by backend transition rules, not only by frontend button visibility.

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> LOCKED: contributor submits / director locks
  LOCKED --> RECONCILING: week closes
  RECONCILING --> RECONCILED: actual value accepted
  RECONCILING --> CARRIED_FORWARD: still valuable, not complete
  CARRIED_FORWARD --> DRAFT: copied into next planning week
  RECONCILED --> [*]
```

### State Responsibilities

- `DRAFT`: contributor can create, edit, delete, and link commitments.
- `LOCKED`: commitment becomes the weekly contract; edits require manager override or a new note.
- `RECONCILING`: contributor records actual value, completion state, blockers, and carry-forward request.
- `RECONCILED`: manager accepts actuals and closes the record.
- `CARRIED_FORWARD`: unfinished work is intentionally moved into the next week with context.

## Domain Model

Core entities:

- `RallyCry`: top-level strategic focus.
- `DefiningObjective`: objective under a Rally Cry.
- `SupportingOutcome`: concrete outcome under a Defining Objective.
- `WeeklyCommitment`: the unit of weekly work.
- `ReviewEvent`: proposed next entity for manager comments, approvals, overrides, and audit history.
- `WorkflowTransition`: proposed next entity for explicit lifecycle audit.

Key `WeeklyCommitment` fields:

- `ownerUserId`
- `ownerName`
- `managerUserId`
- `title`
- `plannedValue`
- `actualValue`
- `status`
- `chessLayer`
- `supportingOutcomeId`
- `dueDate`
- `confidence`
- `blockerReason`
- `carryForwardReason`

## View Contracts

### Director View

The Director view should answer these questions quickly.

- Which commitments are linked to the current Rally Cry?
- Which outcomes are undercovered or overcommitted?
- Which people are blocked?
- Which work is high leverage but low confidence?
- Which reconciliation records need review?
- What should be carried forward, canceled, or escalated?

Primary interactions:

- Lock team week.
- Review individual plans.
- Reassign or request clarification.
- Approve reconciliation.
- Carry forward work into next week.
- Filter by RCDO, person, chess layer, status, and confidence.

### Contributor View

The Contributor view should make planning fast but disciplined.

- Create a weekly commitment.
- Pick the Supporting Outcome from the hierarchy.
- Choose chess layer and expected value.
- Lock the plan.
- Reconcile actual value at week end.
- Request carry-forward with reason.

Primary interactions:

- Add commitment.
- Edit draft.
- Attach RCDO link.
- Submit weekly plan.
- Record actual outcome.
- Explain blockers.

## API Surface

Current endpoints:

- `GET /api/weekly-commitments/current`
- `POST /api/weekly-commitments`
- `PUT /api/weekly-commitments/{id}/reconciliation`
- `GET /api/manager-dashboard/commitments`

Recommended next endpoints:

- `GET /api/rcdo/tree`
- `PUT /api/weekly-commitments/{id}`
- `DELETE /api/weekly-commitments/{id}`
- `POST /api/weeks/{weekId}/lock`
- `POST /api/weekly-commitments/{id}/transition`
- `POST /api/weekly-commitments/{id}/review`
- `POST /api/weekly-commitments/{id}/carry-forward`

Recommended transition request:

```json
{
  "targetStatus": "RECONCILED",
  "actualValue": "Partner onboarding checklist adopted by 4 portfolio companies",
  "reviewNote": "Accepted. Strong signal for repeatable operating cadence."
}
```

## Frontend Architecture

The production frontend should keep the micro-frontend boundary small.

- Remote app owns Cadence routes and state.
- Host app owns shell, navigation, and authenticated session.
- RTK Query owns server cache and invalidation.
- Component state owns only local form state and table filters.
- View mode is a first-class UI state: `director` or `contributor`.

Recommended component split:

- `CadenceApp`
- `ViewModeToggle`
- `DirectorDashboard`
- `ContributorWorkspace`
- `CommitmentForm`
- `RcdoPicker`
- `LifecycleRail`
- `CommitmentTable`
- `ReconciliationPanel`
- `ReviewQueue`

## Backend Architecture

The backend should separate transport, policy, and workflow.

- Controller: request/response mapping.
- Service: lifecycle transitions and business rules.
- Policy: user scope and permissions.
- Repository: persistence.
- Mapper: entity/DTO transformation.

The lifecycle service is the most important backend proof because it prevents the frontend from inventing invalid states.

Example rules:

- A commitment cannot lock without a Supporting Outcome.
- A locked commitment cannot be deleted by a contributor.
- Reconciliation cannot happen before lock.
- Carry-forward requires an actual value or blocker reason.
- Director can override state with an audit event.

## Authorization Model

Auth0 should provide identity. Cadence should interpret identity into scope.

- Contributor can read and write own draft commitments.
- Contributor can reconcile own locked commitments.
- Director can read team commitments.
- Director can lock team week and approve reconciliation.
- Admin can maintain RCDO hierarchy.

The current backend has structural Auth0 wiring. A demo mode can use permit-all locally, but production must keep JWT validation and user-derived ownership.

## Performance Model

PRD targets:

- Plan retrieval under 200ms.
- Sub-second initial route render.
- CDN-delivered remote bundle.
- Pageable manager views up to 2000 records.

Technical choices:

- RTK Query deduplicates requests and centralizes invalidation.
- Pageable backend endpoints prevent large team payloads.
- RCDO tree can be cached aggressively because it changes less often than commitments.
- Manager dashboard should request summary metrics separately from paged records.
- Remote bundle should split heavy dashboard and reconciliation surfaces.

## Technical Proof Points

Already proven locally:

- Frontend tests pass.
- Frontend typecheck passes.
- Frontend build emits the remote.
- Chromium E2E passes.
- Backend tests pass.
- Maven verify, Spotless, SpotBugs, and JaCoCo run.

Commands:

```bash
yarn test
yarn typecheck
yarn build
yarn e2e

cd backend
./mvnw test
./mvnw verify spotless:check spotbugs:check
```

Proof still needed:

- Real persistence through the full create/edit/lock/reconcile/review loop.
- Lifecycle transition tests around every valid and invalid state change.
- Backend pagination test with realistic manager data volume.
- Auth0 tenant integration or a documented local substitute.
- Host app smoke test if ST6 provides the host shell.

## Demo Stories

These are manufactured but plausible stories for showing business impact.

### Story 1: Portfolio Operating Review

Director Mira owns the Rally Cry "Raise portfolio operating velocity." On Monday, her team enters 42 commitments. Cadence shows that 36 are linked to the Rally Cry, 4 are linked to lower-priority hiring outcomes, and 2 are unlinked. Mira asks for clarification before lock, preventing a week of misaligned work.

Business impact: alignment issues are caught before execution, not during Friday review.

### Story 2: Hiring Bottleneck

Contributor Nikolay creates a Queen-layer commitment to reconcile hiring commitments across portfolio companies. By Wednesday, confidence drops from 74% to 48% because two owners have not supplied status. The Director view surfaces it as high-leverage, low-confidence work, so Mira reassigns support and keeps the hiring plan moving.

Business impact: manager intervention happens midweek while the outcome is still recoverable.

### Story 3: Carry-Forward Discipline

Contributor Amara misses a board-readiness commitment because legal review blocks a dependency. Cadence requires actual value and carry-forward reason. The Director accepts the carry-forward, links it to the same Supporting Outcome, and preserves the blocker note for next week.

Business impact: unfinished work is not silently copied forward. It carries context, owner, and strategic reason.

## Render Options

Three static render directions are included under `docs/render-options`.

- `option-1-operating-room.html`: dense operating dashboard for weekly triage.
- `option-2-workflow-timeline.html`: lifecycle-first view that makes state progression obvious.
- `option-3-executive-ledger.html`: table-led control surface for data-heavy review.

Each option includes:

- Director/Contributor toggle.
- RCDO-linked commitments.
- Lifecycle stages.
- Manager review and contributor reconciliation surfaces.
- Technical proof panel.
- Demo stories with business impact.

## Honest Product Gaps

The current scaffold is technically credible, but it is not yet a finished weekly planning product.

The next best build slice is:

1. Add real Director/Contributor mode to the React app.
2. Add full commitment form fields and RCDO tree picker.
3. Implement lifecycle service in Spring Boot.
4. Add lock, transition, review, and carry-forward endpoints.
5. Add reconciliation UI.
6. Add tests for lifecycle rules and manager dashboard behavior.

That slice would turn the scaffold from "architecture proof" into "usable demo alpha."
