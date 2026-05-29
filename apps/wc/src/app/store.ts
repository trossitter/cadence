import { configureStore } from '@reduxjs/toolkit';

import { cadenceApi } from './api/cadence-api';
import { authReducer } from './auth/auth-slice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    [cadenceApi.reducerPath]: cadenceApi.reducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(cadenceApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
