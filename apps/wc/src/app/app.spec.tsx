import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from 'react-redux';

import { cadenceApi } from './api/cadence-api';
import App from './app';
import { authReducer } from './auth/auth-slice';

class MockRequest {
  url: string;
  init?: RequestInit;

  constructor(input: string | { url: string }, init?: RequestInit) {
    this.url = typeof input === 'string' ? input : input.url;
    this.init = init;
  }

  clone() {
    return new MockRequest(this.url, this.init);
  }
}

function renderApp() {
  const testStore = configureStore({
    reducer: {
      auth: authReducer,
      [cadenceApi.reducerPath]: cadenceApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(cadenceApi.middleware),
  });

  return render(
    <Provider store={testStore}>
      <App />
    </Provider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('Request', MockRequest);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ message: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          }),
        ),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the contributor workflow with the required commitment fields', () => {
    renderApp();

    expect(
      screen.getByRole('heading', { name: /Week of June 1/i }),
    ).toBeTruthy();
    expect(screen.getByText('Week walkthrough')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Contributor' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Director' })).toBeTruthy();
    expect(screen.getByLabelText('Owner')).toBeTruthy();
    expect(screen.getByLabelText('Supporting outcome')).toBeTruthy();
    expect(screen.getByLabelText('Chess layer')).toBeTruthy();
    expect(screen.getByLabelText('Risk')).toBeTruthy();
    expect(screen.getByLabelText('Due date')).toBeTruthy();
    expect(screen.getByLabelText('Planned value')).toBeTruthy();
  });

  it('walks the demo lifecycle forward to review', () => {
    renderApp();

    fireEvent.click(
      screen.getByRole('button', { name: /Review Day 5 Typical Fri/i }),
    );

    expect(
      screen.getByText(/Directors approve, escalate, or carry work forward/i),
    ).toBeTruthy();
    expect(screen.getAllByText('Reconciled').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carried Forward').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Data import validation carried into next week/i)
        .length,
    ).toBeGreaterThan(0);
  });

  it('creates a fixture-backed commitment when the API is unavailable', async () => {
    renderApp();

    fireEvent.change(screen.getByLabelText('Owner'), {
      target: { value: 'Avery Chen' },
    });
    fireEvent.change(screen.getByLabelText('Commitment title'), {
      target: { value: 'Publish partner metric digest' },
    });
    fireEvent.change(screen.getByLabelText('Planned value'), {
      target: {
        value: 'Partner digest sent to directors before Friday review',
      },
    });
    fireEvent.change(screen.getByLabelText('Chess layer'), {
      target: { value: 'ROOK' },
    });
    fireEvent.change(screen.getByLabelText('Risk'), {
      target: { value: 'AT_RISK' },
    });
    fireEvent.change(screen.getByLabelText('Due date'), {
      target: { value: '2026-06-06' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add commitment/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText('Publish partner metric digest').length,
      ).toBeGreaterThan(0);
    });

    expect(
      screen.getByText('Partner digest sent to directors before Friday review'),
    ).toBeTruthy();
    expect(screen.getAllByText('Avery Chen').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/alpha workspace while the Cadence API is unavailable/i),
    ).toBeTruthy();
  });

  it('saves reconciliation with carry-forward fallback', async () => {
    renderApp();

    fireEvent.change(
      screen.getByLabelText(
        'Actual value for Close launch quality gates for onboarding refresh',
      ),
      {
        target: {
          value: 'Launch risk remains open for data import validation',
        },
      },
    );
    fireEvent.click(
      screen.getByLabelText(
        'Carry forward Close launch quality gates for onboarding refresh',
      ),
    );
    fireEvent.click(
      screen.getByLabelText(
        'Save reconciliation for Close launch quality gates for onboarding refresh',
      ),
    );

    await waitFor(() => {
      expect(screen.getAllByText('Carried Forward').length).toBeGreaterThan(0);
    });

    expect(
      screen.getAllByText(
        /Launch risk remains open for data import validation/i,
      ).length,
    ).toBeGreaterThan(0);
  });

  it('switches to director review and records a manager decision locally', async () => {
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Director' }));

    expect(screen.getByText('Team roll-up')).toBeTruthy();
    expect(screen.getByText('Manager review')).toBeTruthy();
    expect(screen.getByText('Strategic drift')).toBeTruthy();
    expect(screen.getAllByText('Outcome Deprioritized').length).toBeGreaterThan(
      0,
    );

    fireEvent.change(
      screen.getByLabelText('Review decision for Nikolay Ivanov'),
      {
        target: { value: 'ESCALATED' },
      },
    );
    fireEvent.change(screen.getByLabelText('Review note for Nikolay Ivanov'), {
      target: { value: 'Needs blocker cleared before lock' },
    });
    fireEvent.click(screen.getByLabelText('Record review for Nikolay Ivanov'));

    await waitFor(() => {
      expect(
        screen.getByText('Escalated: Needs blocker cleared before lock'),
      ).toBeTruthy();
    });
  });
});
