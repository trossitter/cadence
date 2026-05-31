import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// The demo host consumes Cadence as a Module Federation remote. The remote must
// be served as a federation *build* (it emits remoteEntry.js), i.e.
//   nx build @org/wc && nx preview @org/wc
//
// Override the URL when the remote runs on a non-default port — e.g. when 4200
// is already taken by a live dev server and you preview the build on 4202:
//   CADENCE_REMOTE_ENTRY=http://localhost:4202/assets/remoteEntry.js nx serve @org/host
const remoteEntry =
  process.env.CADENCE_REMOTE_ENTRY ?? 'http://localhost:4200/assets/remoteEntry.js';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/host',
  server: {
    port: 4201,
    host: 'localhost',
  },
  preview: {
    port: 4201,
    host: 'localhost',
  },
  define: {
    // Surfaced to the client so it can <link> the remote's stylesheet by URL.
    __CADENCE_REMOTE_ORIGIN__: JSON.stringify(new URL(remoteEntry).origin),
  },
  plugins: [
    react(),
    federation({
      name: 'host',
      remotes: {
        cadence: remoteEntry,
      },
      shared: ['react', 'react-dom', '@reduxjs/toolkit', 'react-redux'],
    }),
  ],
  build: {
    target: 'esnext',
    modulePreload: false,
    outDir: './dist',
    emptyOutDir: true,
  },
}));
