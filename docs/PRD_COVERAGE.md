# Cadence PRD Coverage

This is the blunt map from product intent to repository proof. It separates implemented code, static demo work, and unfinished product behavior.

## Director/Contributor Workflow

Target workflow:

1. Contributor drafts weekly commitments and links each one to a Supporting Outcome.
2. Director reviews team coverage, asks for clarification, and locks the week.
3. Contributor executes work, updates confidence/blockers, and records actual value at week end.
4. Director reviews reconciliation, approves actuals, requests changes, or carries work forward.
5. Carry-forward work preserves owner, blocker reason, RCDO link, and next-week intent.

What exists now:

- `apps/wc` has a local Contributor/Director workspace toggle. Contributor mode supports alpha create/edit/reconciliation surfaces, and Director mode supports alpha team roll-up, week lock, and manager review surfaces.
- `apps/wc/src/app/api/cadence-api.ts` has RTK Query endpoints for current week, create, update, lock, reconciliation, review, and manager dashboard, though a few newer paths/statuses still need backend contract alignment.
- `backend/src/main/java/com/st6/cadence/domain/WeeklyCommitmentWorkflow.java` owns commitment-level create, update, delete, lock, review, reconciliation, transition, and carry-forward rules.
- `backend/src/main/java/com/st6/cadence/web/WeeklyCommitmentController.java` exposes current-week, create, update, delete, lock, transition, review, reconciliation, carry-forward, and pageable manager endpoints.
- `docs/render-options/option-2-workflow-timeline.html` has a working static Director/Contributor toggle and shows the intended review/reconciliation surfaces.
- `apps/wc-e2e/src/example.spec.ts` verifies the real Contributor/Director toggle, create, reconciliation, and manager review path with mocked API responses, plus the static Director/Contributor toggle.

What does not exist yet:

- No Auth0/PA-host permission switch backs the Director/Contributor mode; it is local UI state.
- Frontend lock/review API hooks and status types still need cleanup against the current backend controller contract.
- No week-level lock endpoint exists; lock/review/carry-forward are commitment-level operations.
- No review event or transition audit table exists; current workflow metadata lives on `weekly_commitments`.
- No browser proof exercises the full workflow against the real backend.
- No real ST6 Auth0 tenant, PA host mounting proof, or Outlook/Microsoft Graph integration exists.

## PRD Coverage Matrix

| Requirement                              | Coverage        | Evidence                                                                                                                                               | Remaining gap                                                                                     |
| ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| Weekly commitments map to RCDO           | Partial         | Flyway schema, seeded RCDO rows, table display, create payload requiring `supportingOutcomeId`                                                         | RCDO tree endpoint and production picker                                                          |
| Contributor can create weekly commitment | Partial         | React create form, RTK Query mutation, backend `POST /api/weekly-commitments`, E2E mocked create path                                                  | Production validation, owner scope, RCDO tree data, persistence proof with real backend in E2E    |
| Contributor can reconcile actuals        | Partial         | React reconciliation queue, RTK Query reconciliation mutation, backend `PUT /api/weekly-commitments/{id}/reconciliation`, workflow transition guard    | Real-backend E2E proof and fuller proof/carry-forward UX                                          |
| Director can view team commitments       | Partial         | Pageable manager endpoint, current table, Director team roll-up                                                                                        | No production filters, permission scope, or scale proof                                           |
| Director can lock/review/carry forward   | Partial         | React Director lock/review controls, workflow service, and controller endpoints exist for commitment-level lock, review, transition, and carry-forward | Week-level lock, frontend/backend path alignment, real-backend E2E proof, and event audit history |
| Lifecycle state machine                  | Backend partial | `CommitmentStatus`, workflow transition rules, invalid transition exception, workflow columns                                                          | Needs direct service tests for all valid/invalid transitions and frontend type alignment          |
| Manager scale target                     | Skeleton        | Spring Data `Pageable` endpoint                                                                                                                        | No seeded load test, no 175-person/2000-record UX proof                                           |
| Auth0 integration                        | Scaffold        | Resource-server configuration and token header plumbing                                                                                                | No ST6 tenant, RBAC/scope policy, or host session handoff                                         |
| Module Federation                        | Partial         | Vite remote config and build output                                                                                                                    | Not mounted in PA host app                                                                        |
| Demo readiness                           | Partial         | README, architecture docs, render options, focused E2E proof                                                                                           | No recorded walkthrough, no production-like backend demo data                                     |

## Architecture Choices To Defend

- Vite Module Federation keeps Cadence deployable as a remote inside the PA host while preserving React 18/Vite 5 constraints.
- RTK Query is the right cache boundary because current week, create, reconciliation, and manager views all share the same commitment records.
- Spring Boot plus Flyway/JPA gives the prototype a production-shaped backend, and `WeeklyCommitmentWorkflow` is the right home for lifecycle rules.
- RCDO links belong in the persistence model, not only in UI labels, because the business goal is alignment proof.
- Lifecycle enforcement belongs on the backend. The frontend can make the happy path obvious, but it should not be trusted to prevent invalid states.

## Demo Stories

Use these stories as target workflow narratives. Pair them with the React alpha workflow and static renders, and be explicit about which parts are implemented.

### Director Alignment Review

Mira reviews the weekly team board before lock. Most commitments map to "Raise portfolio operating velocity," but a small set points at lower-priority outcomes. In the current repo, this is represented by the Director roll-up/review alpha UI and the static Director render, not a permission-backed production review queue.

### Contributor Reconciliation

Nikolay starts with a Queen-layer hiring commitment. By reconciliation, he records partial actual value and a blocker reason. In the current repo, Contributor mode exposes a reconciliation queue and the backend can accept reconciliation updates, but browser proof against the real backend is still missing.

### Carry-Forward Discipline

Amara misses board-readiness work because legal review blocks a dependency. In the target workflow, carry-forward requires actual value, blocker reason, and next-week intent. In the current repo, `WeeklyCommitmentWorkflow` can close the current commitment and create a next-week draft; it still does not record a separate Director decision event.

## Interview Explanation

Recommended framing:

> "I built the production-shaped spine first: a React 18/Vite Module Federation remote, a real Contributor/Director alpha workflow, RTK Query API boundary, Spring Boot/Flyway/JPA backend, commitment-level workflow service, Auth0 resource-server wiring, and Playwright/unit/backend verification. The product insight is that weekly work has to attach to the RCDO hierarchy, or managers cannot tell whether the team is executing strategy. The honest gap is production depth: the workflow exists as an alpha, but permission-backed role scope, week-level operations, event audit history, backend contract cleanup, and host integration are still the next implementation slices."

Avoid claiming:

- "The Director dashboard is production-ready."
- "The full week lifecycle is production-ready."
- "Auth0 is integrated with ST6."
- "The remote has been mounted in PA."
- "Outlook integration works."

What to show:

- The current React remote for the Contributor/Director alpha workflow.
- The static timeline render for the clearest workflow narrative.
- The workflow service, backend controller, and schema to show the RCDO-linked data contract and lifecycle direction.
- The E2E spec to show proof discipline around current behavior and demo toggle behavior.
