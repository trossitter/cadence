import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

import type { RootState } from '../store';
import type {
  ManagerCommitmentPage,
  ReconciliationUpdate,
  WeeklyCommitment,
  WeeklyCommitmentDraft,
  WeeklyCommitmentWeek,
} from '../types';

const apiBaseUrl = import.meta.env.VITE_CADENCE_API_URL ?? 'http://localhost:8080/api';

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
      invalidatesTags: [{ type: 'WeeklyCommitment', id: 'CURRENT' }],
    }),
    updateReconciliation: builder.mutation<WeeklyCommitment, ReconciliationUpdate>({
      query: ({ commitmentId, ...body }) => ({
        url: `/weekly-commitments/${commitmentId}/reconciliation`,
        method: 'PUT',
        body,
      }),
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
      providesTags: [{ type: 'ManagerDashboard', id: 'TEAM' }],
    }),
  }),
});

export const {
  useCreateCommitmentMutation,
  useGetCurrentWeekQuery,
  useGetManagerDashboardQuery,
  useUpdateReconciliationMutation,
} = cadenceApi;
