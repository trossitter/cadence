# Cadence

Cadence is a weekly execution-planning module for ST6 Partners. It replaces loose 15Five-style weekly check-ins with a guided workflow where every commitment is tied to the RCDO hierarchy:

`Rally Cry -> Defining Objective -> Supporting Outcome`

The product is shaped as a micro-frontend remote that can be mounted inside an existing PA host app. The host keeps navigation, auth, and shell ownership; Cadence owns the weekly execution loop: plan, link, lock, review, reconcile, and carry forward.

## What To Try First

Open the app and follow the shortest path:

1. In `Contributor`, create a commitment.
2. Pick a Supporting Outcome so the work has a strategic address.
3. Add planned value, owner, chess layer, and due date.
4. Toggle to `Director` and review the team roll-up.
5. Return to `Contributor` and reconcile actual value or carry the work forward.

The intended UX direction is guided and action-first. The user should know the next move immediately. Tables exist for review, but the main product should feel more like configuring and confirming a high-value commitment than filling out a tax form line by line.

## What Is Real

- React 18 frontend under `apps/wc`.
- Vite Module Federation remote named `cadence`, exposing `./CadenceApp` and a self-contained `./CadenceRoot` (its own store + auth) for host mounting.
- Demo host harness (`apps/host`) that mounts the `cadence` remote over Module Federation; see `docs/HOST_HARNESS.md`.
- Contributor/Director workspace toggle in the React app.
- Contributor create/edit form with owner, Supporting Outcome, chess layer, due date, and planned value.
- Contributor reconciliation queue with actual value and carry-forward path.
- Director team roll-up, lock action, manager review decision, and review note surface.
- RTK Query API layer for current week, create, update, lock, reconciliation, review, and manager dashboard calls.
- Spring Boot 3.3 backend under `backend`.
- Java 21, Spring Data JPA, PostgreSQL, Flyway, Auth0 resource-server wiring, JaCoCo, Spotless, and SpotBugs.
- Audited RCDO and weekly commitment entities.
- `WeeklyCommitmentWorkflow` service enforcing commitment-level lifecycle rules.
- Backend endpoints for CRUD, lock, transition, review, reconciliation, carry-forward, and manager dashboard.
- Flyway migrations for RCDO seed data plus workflow metadata.
- Static HTML render options for three Director/Contributor product directions.
- Frontend unit, typecheck, build, Chromium E2E, backend tests, JaCoCo, Spotless, and SpotBugs pass locally.

## What Is Still Alpha

- A demo host harness (`apps/host`) now mounts the remote, but host integration is not yet verified end-to-end or against the real PA host.
- The Contributor/Director toggle is local UI state, not permission-backed by the PA host or Auth0.
- The backend has commitment-level lifecycle enforcement, but not a full week aggregate with durable transition events.
- RCDO selection uses seeded/demo options in the UI; there is no `GET /api/rcdo/tree` endpoint yet.
- Outlook/Microsoft Graph integration is not implemented.
- Manager dashboard pagination exists at the API shape level, but not with a production-scale 175-person data set.
- E2E covers the frontend workflow with mocked API responses; browser proof against the real backend is the next useful hardening step.

## Why This Stack

- **Vite Module Federation**: matches the micro-frontend requirement and lets Cadence mount into a host without rewriting the host.
- **React**: fits the existing PA-style frontend target and supports a focused interactive workflow.
- **RTK Query**: keeps API state, caching, and invalidation centralized instead of scattering fetch calls through the UI.
- **Spring Boot**: gives a production-shaped service layer, validation path, security integration, and test ecosystem.
- **PostgreSQL + Flyway**: fits the relational domain: RCDO hierarchy, weekly commitments, lifecycle state, review metadata, and carry-forward links.
- **JaCoCo + Spotless + SpotBugs**: prove this is not only a visual prototype; the backend has enforceable quality gates.
- **Playwright**: proves the actual user path across Contributor and Director surfaces.

## Repository Map

```text
cadence/
  apps/
    wc/        React + Vite Module Federation remote
    wc-e2e/    Playwright E2E tests
  backend/     Spring Boot / Java 21 API
  docs/        Architecture, PRD coverage, render options, AI usage notes
  docker-compose.yml
```

Key files:

- `apps/wc/src/app/app.tsx`
- `apps/wc/src/app/api/cadence-api.ts`
- `backend/src/main/java/com/st6/cadence/domain/WeeklyCommitmentWorkflow.java`
- `backend/src/main/java/com/st6/cadence/web/WeeklyCommitmentController.java`
- `docs/ARCHITECTURE.md`
- `docs/PRD_COVERAGE.md`

## Run Locally

Install dependencies:

```bash
yarn install
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Use Java 21 if installed through Homebrew:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH
```

Run the backend in local permit-all mode:

```bash
cd backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

Run the frontend:

```bash
yarn dev
```

Open:

```text
http://localhost:4200
```

## Verify

Frontend:

```bash
yarn typecheck
yarn test
yarn build
yarn e2e
```

Backend:

```bash
cd backend
./mvnw test
./mvnw verify spotless:check spotbugs:check
```

Last local verification on May 31, 2026:

- `yarn typecheck`
- `yarn test`
- `yarn build`
- `yarn e2e`
- `./mvnw test`
- `./mvnw verify spotless:check spotbugs:check`

## Render Options

Static product directions live in `docs/render-options`.

- `option-1-operating-room.html`: dense manager triage.
- `option-2-workflow-timeline.html`: lifecycle-first guided flow.
- `option-3-executive-ledger.html`: data-heavy review and audit surface.

For the mounted-host demo, the strongest UX direction is the timeline/guided flow: fewer clicks, one obvious next action, and immediate visual feedback about strategic alignment.

## Interview Summary

Cadence is not just a form for weekly status. It is a production-shaped execution system that makes weekly work accountable to strategy. The technical spine is a federated React remote, RTK Query API boundary, Spring Boot workflow service, PostgreSQL/Flyway persistence, and quality gates. The product spine is a two-role workflow: contributors create and reconcile RCDO-linked commitments; directors review alignment, risk, and carry-forward decisions.

## Bottom Line

This is now a credible workflow alpha, not just a scaffold. The next leap is UX polish inside the artificial host: make the first action obvious, reduce form friction, replace table-first planning with guided commitment construction, and prove the full loop against the real backend.
