# Cadence

Cadence is a weekly execution-planning module intended to replace the current 15Five-style weekly planning flow. It fits as a micro-frontend inside the existing PA host application (meaning the host would continue to own shell navigation, authentication, and broader app context) and owns the weekly commitment workflow: contributor planning, manager/director review, RCDO alignment, reconciliation, and carry-forward. The key product move is that every weekly commitment must link to a Supporting Outcome in the RCDO hierarchy, so weekly work becomes structurally connected to strategy instead of being reviewed as free-form status text.

This repo is intentionally structured like the production target: a Vite Module Federation remote plus a Spring Boot backend. 

Demo video: https://www.loom.com/share/b6b0655980964abcb4bee944bf920a27

## Status

What is real:

- The frontend app exists at `apps/wc`.
- It builds as a Vite 5 Module Federation remote and emits `remoteEntry.js`.
- It uses React 18, Redux Toolkit, RTK Query, Tailwind, and Flowbite React.
- The shipped React UI has a Contributor/Director workspace toggle, a current-week commitment table, RCDO links, lifecycle status, chess layer, contributor create/reconcile forms, and director roll-up/review surfaces.
- Static render options show alternate Director/Contributor demo directions, including a working view toggle in plain HTML.
- The backend exists at `backend`.
- It uses Spring Boot 3.3, Java 21, Spring Data JPA, Flyway, PostgreSQL, Auth0 resource-server wiring, Spotless, SpotBugs, and JaCoCo.
- There is an initial RCDO and weekly-commitment schema with Flyway seed data plus workflow metadata columns.
- The backend has a `WeeklyCommitmentWorkflow` service for create, update, delete, lock, review, reconciliation, transition, and carry-forward behavior.
- Backend smoke, controller, and workflow tests exist.
- Frontend unit, build, typecheck, and Chromium E2E checks pass.
- Chromium E2E now proves the real Contributor/Director alpha workflow path with mocked API responses and the static Director/Contributor demo toggle.
- A plain GitHub Actions workflow exists for frontend and backend checks.

What is not real yet:

- The Director/Contributor toggle is local UI state, not permission-backed role enforcement from Auth0 or the PA host.
- The backend lifecycle rules are only partially proven. There is a commitment-level workflow service, but no week-level lock endpoint, separate transition audit history, or frontend lifecycle workflow.
- CRUD is still incomplete from a product perspective. Backend update/delete exist, but list-by-user, production validation UX, and frontend reconciliation/review flows are not complete.
- Some newer frontend API hooks and types still need contract alignment with the current backend workflow endpoints and statuses; alpha fallback writes can make the UI look more complete than the backend path currently is.
- Auth0 is wired structurally but not integrated with a real ST6 tenant.
- A demo host harness (`apps/host`) now mounts the remote over Module Federation, but the remote has not been tested inside the real PA host app or verified end-to-end.
- Outlook/Microsoft Graph integration is not implemented.
- Manager dashboard pagination has backend shape, but not the final production UX for 175+ people or 2000 records.
- Tests use H2 for the Spring smoke path, not Testcontainers PostgreSQL.
  


## Architecture

```text
cadence/
├── apps/
│   ├── wc/        # React 18 + Vite 5 Module Federation remote
│   ├── wc-e2e/    # Playwright E2E tests
│   └── host/      # Demo MF host that mounts the cadence remote
├── backend/       # Spring Boot 3.3 / Java 21 API
├── docs/          # Technical notes and AI usage log
└── docker-compose.yml
```

The deeper architecture and demo proof narrative lives in `docs/ARCHITECTURE.md`.

The brutal PRD coverage matrix lives in `docs/PRD_COVERAGE.md`. Short version:

- Covered: micro-frontend remote shape, RCDO-linked commitment display, add-commitment API path, Spring Boot/Flyway/JPA scaffold, commitment-level workflow service, pageable manager endpoint, Auth0 resource-server structure, and local automated checks.
- Partially covered: Director/Contributor workflow, lifecycle states, manager review, reconciliation, carry-forward, and demo storytelling. These exist as alpha React surfaces, backend workflow, architecture, static renders, API hooks, or simple endpoints, not as a finished operating workflow.
- Not covered: PA host integration, real ST6 Auth0 tenant, Outlook/Microsoft Graph, week-level lock workflow, separate review/transition audit history, production scale proof, and demo video.

Static render directions for the Director/Contributor split live in `docs/render-options`:

- `option-1-operating-room.html`
- `option-2-workflow-timeline.html`
- `option-3-executive-ledger.html`

## Frontend

The frontend is a client-side SPA remote:

- Remote name: `cadence`
- Remote entry: `apps/wc/dist/assets/remoteEntry.js`
- Exposed modules: `./CadenceApp` and `./CadenceRoot` (self-contained — own store + auth — used by the demo host)
- Local dev port: `4200`

A demo Module Federation host that mounts the remote lives at `apps/host` (see `docs/HOST_HARNESS.md`).

Main files:

- `apps/wc/src/app/app.tsx`
- `apps/wc/src/app/api/cadence-api.ts`
- `apps/wc/vite.config.mts`

## Backend

The backend is a Spring Boot API with:

- Audited JPA entities
- RCDO hierarchy tables
- Weekly commitment table
- Pageable manager endpoint
- Auth0 JWT resource server configuration
- Flyway migration and seed data

Main files:

- `backend/src/main/java/com/st6/cadence/web/WeeklyCommitmentController.java`
- `backend/src/main/java/com/st6/cadence/domain`
- `backend/src/main/resources/db/migration/V1__initial_schema.sql`

## Local Setup

Install dependencies:

```bash
yarn install
```

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Set Java 21 if using Homebrew OpenJDK:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export PATH=/opt/homebrew/opt/openjdk@21/bin:$PATH
```

Run the frontend:

```bash
yarn dev
```

Run the backend:

```bash
cd backend
./mvnw spring-boot:run
```

## Verification

Frontend:

```bash
yarn test
yarn typecheck
yarn build
yarn e2e
```

Backend:

```bash
cd backend
./mvnw test
./mvnw verify spotless:check spotbugs:check
```

Verified locally on May 28, 2026:

- `yarn test`
- `yarn typecheck`
- `yarn build`
- `yarn e2e`
- `./mvnw test`
- `./mvnw verify spotless:check spotbugs:check`

Verified locally on May 31, 2026:

- `yarn e2e`

Backend note: `./mvnw test` was not completed in the May 31 pass because the default shell could not locate a Java runtime. Use the Java 21 setup above before rerunning backend verification.

## Environment

Copy `.env.example` to `.env` and replace placeholders when real ST6 values exist.

Current placeholders include:

- Auth0 issuer, client ID, and audience
- Cadence API URL
- PostgreSQL credentials

## Open Decisions

- Clarify Microsoft Graph scope: calendar sync, email notifications, or both.
- Get ST6 Auth0 tenant/client configuration.
- Determine if backend integration tests should use Testcontainers PostgreSQL before demo.

## AI Usage

AI usage is tracked in `docs/AI_USAGE_LOG.md`.


