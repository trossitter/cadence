// Injected by vite.config.mts `define` — origin of the Cadence remote.
declare const __CADENCE_REMOTE_ORIGIN__: string;

// Module Federation remote exposed by apps/wc (name: "cadence").
declare module 'cadence/CadenceRoot' {
  import type { ComponentType } from 'react';
  const CadenceRoot: ComponentType;
  export default CadenceRoot;
}
