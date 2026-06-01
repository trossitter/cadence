import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { RootState } from '../store';
import type {
  CommitmentRisk,
  ManagerReviewUpdate,
  ManagerCommitmentPage,
  ReconciliationUpdate,
  WeeklyCommitment,
  WeeklyCommitmentDraft,
  WeeklyCommitmentUpdate,
  WeeklyCommitmentWeek,
} from '../types';

const apiBaseUrl = import.meta.env.VITE_CADENCE_API_URL ?? 'http://localhost:8080/api';

const knownRisks: readonly CommitmentRisk[] = ['ON_TRACK', 'AT_RISK', 'BLOCKED'];

// The render layer treats `risk` as a guaranteed enum (RiskChip lowercases it).
// A response missing or carrying an unknown risk would throw mid-render and blank
// the whole app, so we contain malformed responses at this boundary.
function withSafeRisk(commitment: WeeklyCommitment): WeeklyCommitment {
  return knownRisks.includes(commitment.risk)
    ? commitment
    : { ...commitment, risk: 'ON_TRACK' };
}

function normalizeWeek(week: WeeklyCommitmentWeek): WeeklyCommitmentWeek {
  return { ...week, commitments: week.commitments.map(withSafeRisk) };
}

function normalizeManagerPage(page: ManagerCommitmentPage): ManagerCommitmentPage {
  return { ...page, content: page.content.map(withSafeRisk) };
}

export const cadenceApi = createApi({
  reducerPath: 'cadenceApi',
  baseQuery: fetchBaseQuery({
    baseUrl: apiBaseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;

      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }

      return headers;
    },
  }),
  tagTypes: ['WeeklyCommitment', 'ManagerDashboard'],
  endpoints: (builder) => ({
    getCurrentWeek: builder.query<WeeklyCommitmentWeek, void>({
      query: () => '/weekly-commitments/current',
      transformResponse: normalizeWeek,
      providesTags: (result) =>
        result
          ? [
              ...result.commitments.map(({ id }) => ({
                type: 'WeeklyCommitment' as const,
                id,
              })),
              { type: 'WeeklyCommitment', id: 'CURRENT' },
            ]
          : [{ type: 'WeeklyCommitment', id: 'CURRENT' }],
    }),
    createCommitment: builder.mutation<WeeklyCommitment, WeeklyCommitmentDraft>({
      query: (body) => ({
        url: '/weekly-commitments',
        method: 'POST',
        body,
      }),
      transformResponse: withSafeRisk,
      invalidatesTags: [{ type: 'WeeklyCommitment', id: 'CURRENT' }],
    }),
    updateCommitment: builder.mutation<WeeklyCommitment, WeeklyCommitmentUpdate>({
      query: ({ commitmentId, ...body }) => ({
        url: `/weekly-commitments/${commitmentId}`,
        method: 'PUT',
        body,
      }),
      transformResponse: withSafeRisk,
      invalidatesTags: (_result, _error, { commitmentId }) => [
        { type: 'WeeklyCommitment', id: commitmentId },
        { type: 'WeeklyCommitment', id: 'CURRENT' },
        { type: 'ManagerDashboard', id: 'TEAM' },
      ],
    }),
    lockCurrentWeek: builder.mutation<WeeklyCommitmentWeek, void>({
      query: () => ({
        url: '/weekly-commitments/current/lock',
        method: 'POST',
      }),
      transformResponse: normalizeWeek,
      invalidatesTags: [
        { type: 'WeeklyCommitment', id: 'CURRENT' },
        { type: 'ManagerDashboard', id: 'TEAM' },
      ],
    }),
    updateReconciliation: builder.mutation<WeeklyCommitment, ReconciliationUpdate>({
      query: ({ commitmentId, ...body }) => ({
        url: `/weekly-commitments/${commitmentId}/reconciliation`,
        method: 'PUT',
        body,
      }),
      transformResponse: withSafeRisk,
      invalidatesTags: (_result, _error, { commitmentId }) => [
        { type: 'WeeklyCommitment', id: commitmentId },
        { type: 'ManagerDashboard', id: 'TEAM' },
      ],
    }),
    reviewCommitment: builder.mutation<WeeklyCommitment, ManagerReviewUpdate>({
      query: ({ commitmentId, ...body }) => ({
        url: `/manager-dashboard/commitments/${commitmentId}/review`,
        method: 'PUT',
        body,
      }),
      transformResponse: withSafeRisk,
      invalidatesTags: (_result, _error, { commitmentId }) => [
        { type: 'WeeklyCommitment', id: commitmentId },
        { type: 'ManagerDashboard', id: 'TEAM' },
      ],
    }),
    getManagerDashboard: builder.query<ManagerCommitmentPage, { page?: number; size?: number }>({
      query: ({ page = 0, size = 50 }) => ({
        url: '/manager-dashboard/commitments',
        params: { page, size },
      }),
      transformResponse: normalizeManagerPage,
      providesTags: [{ type: 'ManagerDashboard', id: 'TEAM' }],
    }),
  }),
});

export const {
  useCreateCommitmentMutation,
  useGetCurrentWeekQuery,
  useGetManagerDashboardQuery,
  useLockCurrentWeekMutation,
  useReviewCommitmentMutation,
  useUpdateCommitmentMutation,
  useUpdateReconciliationMutation,
} = cadenceApi;
