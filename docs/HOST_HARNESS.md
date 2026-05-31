# Demo host harness

Cadence is a **Module Federation remote** — in production it mounts inside ST6's
PA host app, not on its own. The harness in `apps/host` is a minimal artificial
host that consumes the published `remoteEntry.js` exactly as PA will, so the
remote can be demonstrated and tested as it actually lives.

It also closes the PRD gap *"the remote has not been tested inside a host app."*

## What it proves

- The remote federates: `apps/host` loads `cadence/CadenceRoot` over the network
  from the remote origin and mounts it.
- The remote is self-contained: `CadenceRoot` (apps/wc) brings its own Redux
  store and auth provider, so the host needs zero knowledge of Cadence internals.
- Styling survives federation: the host injects the remote's compiled stylesheet
  (federation does not do this for you — the cause of the "unstyled remote"
  symptom).

## Run it

The remote must be served as a **federation build** (a dev server does not emit a
usable `remoteEntry.js`). Two terminals:

```bash
# Terminal A — build + preview the remote (serves remoteEntry.js on :4200)
nx build @org/wc && nx preview @org/wc

# Terminal B — run the host (on :4201), then open http://localhost:4201
nx serve @org/host
```

Or via the root scripts: `yarn demo:remote` and `yarn demo:host`.

No backend is required — the app falls back to `sampleWeek` fixtures and shows a
"Cadence API is unavailable" notice, so the harness renders fully populated and
styled offline. For live data, start the backend and Postgres as usual.

### Coexisting with a dev server already on :4200

If `:4200` is taken (e.g. a live dev server), preview the remote on another port
and point the host at it:

```bash
nx preview @org/wc -- --port 4202
CADENCE_REMOTE_ENTRY=http://localhost:4202/assets/remoteEntry.js nx serve @org/host
```

## Test it

With both servers up:

```bash
node scripts/host-smoke.mjs        # or: yarn demo:smoke
```

The smoke test (headless Chromium) asserts:

1. the host shell renders,
2. the federated Cadence remote mounted (brand + Contributor/Director toggle),
3. the remote's CSS loaded (the eyebrow is `text-slate-500`, not default black),
4. the injected stylesheet `<link>` is present.

Exit code is non-zero on any failure. Override the target with
`HOST_URL=http://localhost:4201`.
