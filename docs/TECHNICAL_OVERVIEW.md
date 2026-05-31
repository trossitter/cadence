# Cadence Technical Overview

Cadence is a weekly planning micro-frontend remote for ST6 Partners. It replaces optional alignment habits with structural RCDO linking: every weekly commitment references a Supporting Outcome under the Rally Cry to Defining Objective to Outcome hierarchy.

## Frontend

- React 18 single-page application under `apps/wc`.
- Vite 5 remote using `@originjs/vite-plugin-federation`.
- Exposes `./CadenceApp` from `remoteEntry.js`.
- Redux Toolkit and RTK Query own all API access.
- Flowbite React components with Tailwind utility classes.
- Auth0 is configured through `VITE_AUTH0_*` variables. If variables are absent, local development runs without forcing login.
- The current app has a local Contributor/Director workspace toggle with alpha create, reconcile, roll-up, and review surfaces. Static render prototypes under `docs/render-options` remain useful as demo directions.

## Backend

- Spring Boot 3.3 and Java 21 under `backend`.
- PostgreSQL 16.4 with Flyway migrations.
- Spring Data JPA entities extend `AbstractAuditingEntity`.
- Auth0 JWT resource server configuration is environment-driven.
- Team and manager views use Spring Data `Pageable`.
- Current request handlers live in `WeeklyCommitmentController`; commitment-level lifecycle rules live in `WeeklyCommitmentWorkflow`.
- Workflow state is persisted on `weekly_commitments`; there is not yet a separate review or transition event stream.

## PRD Coverage

- Covered: Module Federation remote shape, RCDO-linked commitment display, add-commitment API contract, Spring Boot/Flyway/JPA scaffold, commitment-level workflow service, pageable manager endpoint.
- Partial: Director/Contributor workflow, reconciliation, manager review, lifecycle states, carry-forward, demo proof, and frontend/backend contract alignment.
- Missing: PA host integration, ST6 Auth0 tenant, Outlook/Microsoft Graph, week-level lock workflow, separate review/transition audit history, realistic manager-scale proof.

See `docs/PRD_COVERAGE.md` for the full matrix.

## Local Development

1. Copy `.env.example` to `.env` and fill Auth0 values when available.
2. Start PostgreSQL with `docker compose up -d postgres`.
3. Run the frontend with `yarn dev`.
4. If using Homebrew OpenJDK 21, set `JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home` and prepend `/opt/homebrew/opt/openjdk@21/bin` to `PATH`.
5. Run the backend with `cd backend && ./mvnw spring-boot:run`.

## Open Integration Questions

- Confirm Playwright over Cypress+Cucumber.
- Confirm Microsoft Graph Outlook scope.
- Obtain host Module Federation shared dependency versions.
- Obtain ST6 Auth0 tenant/client values.
- Decide whether the next demo should polish the React workflow toward `docs/render-options/option-2-workflow-timeline.html`, or harden `WeeklyCommitmentWorkflow` with service-level transition tests first.
