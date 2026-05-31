import { Component, StrictMode, Suspense, lazy, useEffect } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import * as ReactDOM from 'react-dom/client';

import './index.css';

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
        <div
          role="alert"
          className="mx-auto my-8 max-w-2xl rounded-xl border border-red-200 bg-white p-8 text-slate-700"
        >
          <h2 className="mt-0 text-lg font-semibold text-red-700">Cadence remote failed to load</h2>
          <p className="mt-2">
            The host expects the remote at{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">{REMOTE_ENTRY}</code>. Build and
            preview it first:{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5">
              nx build @org/wc &amp;&amp; nx preview @org/wc
            </code>
            .
          </p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-900 p-3 text-slate-200">
            {String(this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function DemoHost() {
  useRemoteStyles();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900 px-5 py-2.5 text-sm text-slate-200">
        <div className="font-bold tracking-wide">
          ST6 · PA{' '}
          <span className="ml-2 rounded-full bg-slate-800 px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            demo host
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <span
            className="h-2 w-2 rounded-full bg-green-500 ring-4 ring-green-500/20"
            aria-hidden="true"
          />
          Cadence mounted as a Module Federation remote
          <code className="text-xs text-slate-300">{REMOTE_ENTRY}</code>
        </div>
      </header>
      <main className="flex-1 bg-slate-50">
        <RemoteBoundary>
          <Suspense fallback={<div className="p-8 text-slate-700">Loading Cadence remote…</div>}>
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
