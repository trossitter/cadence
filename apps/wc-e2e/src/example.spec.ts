import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const executionOutcomeId = '11111111-1111-4111-8111-111111111111';
const hiringOutcomeId = '22222222-2222-4222-8222-222222222222';
const launchOutcomeId = '33333333-3333-4333-8333-333333333333';

interface RcdoFixture {
  rallyCry: string;
  definingObjective: string;
  supportingOutcomeId: string;
  supportingOutcome: string;
}

interface CommitmentFixture {
  id: string;
  ownerName: string;
  title: string;
  plannedValue: string;
  actualValue?: string;
  status: 'DRAFT' | 'LOCKED' | 'RECONCILING' | 'RECONCILED' | 'CARRIED_FORWARD';
  chessLayer: 'KING' | 'QUEEN' | 'ROOK' | 'BISHOP' | 'KNIGHT' | 'PAWN';
  dueDate: string;
  risk: 'ON_TRACK' | 'AT_RISK' | 'BLOCKED';
  rcdo: RcdoFixture;
  managerReview?: {
    decision: 'APPROVED' | 'NEEDS_OWNER_UPDATE' | 'ESCALATED';
    note: string;
    reviewedAt: string;
  };
}

const rcdoByOutcomeId: Record<string, RcdoFixture> = {
  [executionOutcomeId]: {
    rallyCry: 'Raise portfolio operating velocity',
    definingObjective: 'Standardize weekly execution signals',
    supportingOutcomeId: executionOutcomeId,
    supportingOutcome: 'Every priority commitment maps to an RCDO outcome',
  },
  [hiringOutcomeId]: {
    rallyCry: 'Build leadership bench strength',
    definingObjective: 'Improve hiring execution quality',
    supportingOutcomeId: hiringOutcomeId,
    supportingOutcome: 'Critical hiring plans are visible weekly',
  },
  [launchOutcomeId]: {
    rallyCry: 'Ship dependable customer moments',
    definingObjective: 'Tighten launch quality gates',
    supportingOutcomeId: launchOutcomeId,
    supportingOutcome: 'Launch blockers have an accountable owner by Friday',
  },
};

test('runs the real Contributor and Director workflow path with mocked API responses', async ({
  page,
}) => {
  const api = await mockCadenceApi(page);
  const title = 'Align Friday partner review';
  const plannedValue = 'Partner digest sent to directors before Friday review';
  const actualValue =
    'Digest shipped, but two launch blockers need director escalation.';
  const reviewNote = 'Needs blocker cleared before next weekly lock';

  await page.goto('/');

  const contributorButton = page.getByRole('button', { name: 'Contributor' });
  const directorButton = page.getByRole('button', { name: 'Director' });

  await expect(
    page.getByRole('heading', { name: /Week of June 1/i }),
  ).toBeVisible();
  await expect(contributorButton).toHaveAttribute('aria-pressed', 'true');
  await expect(directorButton).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('heading', { name: 'Create commitment' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Reconciliation queue' }),
  ).toBeVisible();

  await page.getByLabel('Owner').selectOption('Avery Chen');
  await page.getByLabel('Commitment title').fill(title);
  await page.getByLabel('Planned value').fill(plannedValue);
  await page.getByLabel('Supporting outcome').selectOption(hiringOutcomeId);
  await page.getByLabel('Chess layer').selectOption('ROOK');
  await page.getByLabel('Due date').fill('2026-06-06');
  await page.getByRole('button', { name: 'Add commitment' }).click();

  await expect.poll(() => api.createdPayload?.title).toBe(title);
  expect(api.createdPayload).toMatchObject({
    ownerName: 'Avery Chen',
    title,
    plannedValue,
    supportingOutcomeId: hiringOutcomeId,
    chessLayer: 'ROOK',
    dueDate: '2026-06-06',
  });
  await expect(page.getByText('Commitment created in Cadence.')).toBeVisible();
  await expect(page.getByRole('table').getByText(title)).toBeVisible();
  await expect(page.getByRole('table').getByText(plannedValue)).toBeVisible();

  await page.getByLabel(`Actual value for ${title}`).fill(actualValue);
  await page.getByLabel(`Carry forward ${title}`).check();
  await page.getByLabel(`Save reconciliation for ${title}`).click();

  await expect
    .poll(() => api.reconciliationPayload?.actualValue)
    .toBe(actualValue);
  expect(api.reconciliationPayload).toMatchObject({
    actualValue,
    carryForward: true,
  });
  await expect(
    page.getByText('Reconciliation saved in Cadence.'),
  ).toBeVisible();
  await expect(
    page.getByRole('table').getByText('CARRIED FORWARD'),
  ).toBeVisible();

  await directorButton.click();

  await expect(directorButton).toHaveAttribute('aria-pressed', 'true');
  await expect(contributorButton).toHaveAttribute('aria-pressed', 'false');
  await expect(
    page.getByRole('heading', { name: 'Team roll-up' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Manager review' }),
  ).toBeVisible();

  await page
    .getByLabel('Review decision for Avery Chen')
    .selectOption('ESCALATED');
  await page.getByLabel('Review note for Avery Chen').fill(reviewNote);
  await page.getByLabel('Record review for Avery Chen').click();

  await expect.poll(() => api.reviewPayload?.note).toBe(reviewNote);
  expect(api.reviewPayload).toMatchObject({
    decision: 'ESCALATED',
    note: reviewNote,
  });
  await expect(
    page.getByText('Manager review saved in Cadence.'),
  ).toBeVisible();
  await expect(page.getByText(`Escalated: ${reviewNote}`)).toBeVisible();
});

test('toggles the static Director and Contributor workflow lanes', async ({
  page,
}) => {
  const cwd = process.cwd();
  const workspaceRoot = cwd.endsWith('/apps/wc-e2e')
    ? cwd.slice(0, -'/apps/wc-e2e'.length)
    : cwd;
  const timelineUrl = `file://${workspaceRoot}/docs/render-options/option-2-workflow-timeline.html`;
  const directorButton = page.getByRole('button', { name: 'Director' });
  const contributorButton = page.getByRole('button', { name: 'Contributor' });
  const directorView = page.locator('[data-view="director"]');
  const contributorView = page.locator('[data-view="contributor"]');

  await page.goto(timelineUrl);

  await expect(
    page.getByRole('heading', { name: 'Cadence Workflow Timeline' }),
  ).toBeVisible();
  await expect(directorButton).toHaveAttribute('aria-pressed', 'true');
  await expect(contributorButton).toHaveAttribute('aria-pressed', 'false');
  await expect(directorView).toBeVisible();
  await expect(contributorView).toBeHidden();
  await expect(
    page.getByRole('heading', { name: 'Director Decision Lane' }),
  ).toBeVisible();

  await contributorButton.click();

  await expect(directorButton).toHaveAttribute('aria-pressed', 'false');
  await expect(contributorButton).toHaveAttribute('aria-pressed', 'true');
  await expect(directorView).toBeHidden();
  await expect(contributorView).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Contributor Lane' }),
  ).toBeVisible();

  await page.getByLabel('Completion').selectOption('Blocked');
  await page
    .getByLabel('Actual Value')
    .fill(
      '18 of 21 hiring commitments reconciled. Legal review remains blocked.',
    );
  await page
    .getByLabel('Carry-Forward Reason')
    .fill('Director support needed before next weekly lock.');

  await expect(page.getByLabel('Actual Value')).toHaveValue(
    '18 of 21 hiring commitments reconciled. Legal review remains blocked.',
  );
  await expect(
    page.getByRole('button', { name: 'Submit Reconciliation' }),
  ).toBeVisible();
});

async function mockCadenceApi(page: Page) {
  let createdPayload: Record<string, string> | undefined;
  let reconciliationPayload: Record<string, string | boolean> | undefined;
  let reviewPayload: Record<string, string> | undefined;
  let commitments: CommitmentFixture[] = [
    {
      id: 'sample-1',
      ownerName: 'Mira Petrova',
      title: 'Prepare Q2 operating partner cadence review',
      plannedValue: 'Portfolio review pack ready for IC pre-read',
      actualValue: 'Draft pack is ready; dependency notes need director review',
      status: 'LOCKED',
      chessLayer: 'QUEEN',
      dueDate: '2026-06-05',
      risk: 'ON_TRACK',
      rcdo: rcdoByOutcomeId[executionOutcomeId],
      managerReview: {
        decision: 'APPROVED',
        note: 'Strong enough for Friday review.',
        reviewedAt: '2026-05-30T14:15:00.000Z',
      },
    },
    {
      id: 'sample-2',
      ownerName: 'Nikolay Ivanov',
      title: 'Reconcile weekly hiring commitments',
      plannedValue: 'All overdue actions assigned to an accountable owner',
      actualValue: '18 of 21 reconciled',
      status: 'RECONCILING',
      chessLayer: 'ROOK',
      dueDate: '2026-06-05',
      risk: 'AT_RISK',
      rcdo: rcdoByOutcomeId[hiringOutcomeId],
    },
  ];
  const corsHeaders = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
  };

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (
      url.pathname.endsWith('/weekly-commitments/current') &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        json: {
          weekStart: '2026-06-01',
          state: 'DRAFT',
          commitments,
        },
      });
      return;
    }

    if (
      url.pathname.endsWith('/manager-dashboard/commitments') &&
      request.method() === 'GET'
    ) {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        json: {
          content: commitments,
          number: 0,
          size: 20,
          totalElements: commitments.length,
          totalPages: 1,
        },
      });
      return;
    }

    if (
      url.pathname.endsWith('/weekly-commitments') &&
      request.method() === 'POST'
    ) {
      createdPayload = request.postDataJSON() as Record<string, string>;
      const supportingOutcomeId = createdPayload.supportingOutcomeId;
      const createdCommitment: CommitmentFixture = {
        id: 'created-1',
        ownerName: createdPayload.ownerName,
        title: createdPayload.title,
        plannedValue: createdPayload.plannedValue,
        status: 'DRAFT',
        chessLayer:
          createdPayload.chessLayer as CommitmentFixture['chessLayer'],
        dueDate: createdPayload.dueDate,
        risk: (createdPayload.risk as CommitmentFixture['risk']) ?? 'ON_TRACK',
        rcdo: rcdoByOutcomeId[supportingOutcomeId],
      };
      commitments = [createdCommitment, ...commitments];

      await route.fulfill({
        status: 201,
        headers: corsHeaders,
        json: createdCommitment,
      });
      return;
    }

    if (
      url.pathname.endsWith('/reconciliation') &&
      request.method() === 'PUT'
    ) {
      reconciliationPayload = request.postDataJSON() as Record<
        string,
        string | boolean
      >;
      const id = url.pathname.split('/').at(-2);
      const updatedCommitment = updateCommitment(id, {
        actualValue: String(reconciliationPayload.actualValue),
        status: reconciliationPayload.carryForward
          ? 'CARRIED_FORWARD'
          : 'RECONCILED',
      });

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        json: updatedCommitment,
      });
      return;
    }

    if (
      url.pathname.includes('/manager-dashboard/commitments/') &&
      url.pathname.endsWith('/review')
    ) {
      reviewPayload = request.postDataJSON() as Record<string, string>;
      const id = url.pathname.split('/').at(-2);
      const updatedCommitment = updateCommitment(id, {
        managerReview: {
          decision: reviewPayload.decision as NonNullable<
            CommitmentFixture['managerReview']
          >['decision'],
          note: reviewPayload.note,
          reviewedAt: '2026-06-04T16:00:00.000Z',
        },
      });

      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        json: updatedCommitment,
      });
      return;
    }

    await route.fulfill({
      status: 404,
      headers: corsHeaders,
      json: { message: `Unhandled ${request.method()} ${url.pathname}` },
    });
  });

  function updateCommitment(
    id: string | undefined,
    patch: Partial<CommitmentFixture>,
  ) {
    const existing = commitments.find((commitment) => commitment.id === id);
    const updatedCommitment = { ...(existing ?? commitments[0]), ...patch };
    commitments = commitments.map((commitment) =>
      commitment.id === updatedCommitment.id ? updatedCommitment : commitment,
    );
    return updatedCommitment;
  }

  return {
    get createdPayload() {
      return createdPayload;
    },
    get reconciliationPayload() {
      return reconciliationPayload;
    },
    get reviewPayload() {
      return reviewPayload;
    },
  };
}
