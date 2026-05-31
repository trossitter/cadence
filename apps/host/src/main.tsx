import { Component, StrictMode, Suspense, lazy, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import * as ReactDOM from 'react-dom/client';

import './host.css';

const REMOTE_ORIGIN = __CADENCE_REMOTE_ORIGIN__;
const REMOTE_ENTRY = `${REMOTE_ORIGIN}/assets/remoteEntry.js`;
const REMOTE_STYLES = `${REMOTE_ORIGIN}/assets/style.css`;

const CadenceRoot = lazy(() => import('cadence/CadenceRoot'));

/**
 * Module Federation does not load a remote's stylesheet into the host, so the
 * host injects Cadence's compiled CSS once, by URL, from the remote origin.
 * Without this the federated component mounts but renders unstyled.
 */
function useRemoteStyles() {
  useEffect(() => {
    const id = 'cadence-remote-styles';
    if (document.getElementById(id)) {
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = REMOTE_STYLES;
    document.head.appendChild(link);
  }, []);
}

class RemoteBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Fail loud — a blank screen hides the cause; the cause is almost always
    // "the remote isn't being served".
    console.error('Cadence remote failed to load', error, info);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="host-error" role="alert">
          <h2>Cadence remote failed to load</h2>
          <p>
            The host expects the remote at <code>{REMOTE_ENTRY}</code>. Build and
            preview it first: <code>nx build @org/wc &amp;&amp; nx preview @org/wc</code>.
          </p>
          <pre>{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function DemoHost() {
  useRemoteStyles();
  return (
    <div className="host-shell">
      <header className="host-bar">
        <div className="host-brand">
          ST6 · PA <span className="host-brand-tag">demo host</span>
        </div>
        <div className="host-federation">
          <span className="host-dot" aria-hidden="true" />
          Cadence mounted as a Module Federation remote
          <code>{REMOTE_ENTRY}</code>
        </div>
      </header>
      <main className="host-stage">
        <RemoteBoundary>
          <Suspense fallback={<div className="host-loading">Loading Cadence remote…</div>}>
            <CadenceRoot />
          </Suspense>
        </RemoteBoundary>
      </main>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <DemoHost />
  </StrictMode>,
);
