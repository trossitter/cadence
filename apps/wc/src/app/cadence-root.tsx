import { Provider } from 'react-redux';

import App from './app';
import { CadenceAuthProvider } from './auth/cadence-auth-provider';
import { store } from './store';
import '../styles.css';

/**
 * Self-contained mount point for the Cadence micro-frontend.
 *
 * This is what a host (the PA shell, or the demo harness in apps/host) should
 * consume over Module Federation — it brings its own Redux store and auth
 * provider, so the host needs no knowledge of Cadence internals. The bare
 * `./CadenceApp` expose is kept for consumers that supply their own store.
 */
export function CadenceRoot() {
  return (
    <CadenceAuthProvider>
      <Provider store={store}>
        <App />
      </Provider>
    </CadenceAuthProvider>
  );
}

export default CadenceRoot;
