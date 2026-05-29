# Cadence

Cadence is a prototype weekly-planning module for ST6 Partners. The goal is to replace loose 15Five-style check-ins with a workflow where every weekly commitment must map to the RCDO hierarchy:

Rally Cry -> Defining Objective -> Supporting Outcome.

This repo is intentionally structured like the production target: a Vite Module Federation remote plus a Spring Boot backend. It is not production-ready yet.

## Brutally Honest Status

What is real:

- The frontend app exists at `apps/wc`.
- It builds as a Vite 5 Module Federation remote and emits `remoteEntry.js`.
- It uses React 18, Redux Toolkit, RTK Query, Tailwind, and Flowbite React.
- The UI shows current weekly commitments, RCDO links, lifecycle status, chess layer, and a small add-commitment form.
- The backend exists at `backend`.
- It uses Spring Boot 3.3, Java 21, Spring Data JPA, Flyway, PostgreSQL, Auth0 resource-server wiring, Spotless, SpotBugs, and JaCoCo.
- There is an initial RCDO and weekly-commitment schema with Flyway seed data.
- Backend smoke and controller tests pass.
- Frontend unit, build, typecheck, and Chromium E2E checks pass.
- A plain GitHub Actions workflow exists for frontend and backend checks.

What is not real yet:

- The full weekly lifecycle state machine is not implemented. The enum exists, but transitions are not enforced.
- CRUD is incomplete. Create and reconciliation are sketched; update/delete/list-by-user flows are not complete.
- Auth0 is wired structurally but not integrated with a real ST6 tenant.
- The Module Federation remote has not been tested inside the PA host app.
- Outlook/Microsoft Graph integration is not implemented.
- Manager dashboard pagination has backend shape, but not the final production UX for 175+ people or 2000 records.
- Tests use H2 for the Spring smoke path, not Testcontainers PostgreSQL.
- The CI workflow has not been proven green on GitHub yet.
- No demo video exists yet.

## Architecture

```text
cadence/
├── apps/
│   ├── wc/        # React 18 + Vite 5 Module Federation remote
│   └── wc-e2e/    # Playwright E2E tests
├── backend/       # Spring Boot 3.3 / Java 21 API
├── docs/          # Technical notes and AI usage log
└── docker-compose.yml
```

## Frontend

The frontend is a client-side SPA remote:

- Remote name: `cadence`
- Remote entry: `apps/wc/dist/assets/remoteEntry.js`
- Exposed module: `./CadenceApp`
- Local dev port: `4200`

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

## Environment

Copy `.env.example` to `.env` and replace placeholders when real ST6 values exist.

Current placeholders include:

- Auth0 issuer, client ID, and audience
- Cadence API URL
- PostgreSQL credentials

## Open Decisions

- Confirm Playwright over Cypress/Cucumber with ST6.
- Clarify Microsoft Graph scope: calendar sync, email notifications, or both.
- Get PA host Module Federation shared dependency versions.
- Get ST6 Auth0 tenant/client configuration.
- Decide whether backend integration tests should use Testcontainers PostgreSQL before demo.

## AI Usage

AI usage is tracked in `docs/AI_USAGE_LOG.md`.

## Bottom Line

This is a solid scaffold and a credible first slice. It is not a finished weekly-planning product. The next meaningful work is to implement the actual lifecycle rules, complete weekly commitment CRUD, wire real Auth0, and test the remote inside its host.
