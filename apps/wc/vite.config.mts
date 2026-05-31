/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/wc',
  server: {
    port: 4200,
    host: 'localhost',
    cors: true,
  },
  preview: {
    port: 4200,
    host: 'localhost',
    cors: true,
  },
  plugins: [
    react(),
    federation({
      name: 'cadence',
      filename: 'remoteEntry.js',
      exposes: {
        './CadenceApp': './src/app/app.tsx',
        './CadenceRoot': './src/app/cadence-root.tsx',
      },
      shared: ['react', 'react-dom', '@reduxjs/toolkit', 'react-redux'],
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: false,
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        // Stable CSS filename (no content hash) so a federation host can
        // <link> the remote's compiled stylesheet by a known URL. Federation
        // does not inject a remote's CSS into the host on its own.
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
  test: {
    name: '@org/wc',
    watch: false,
    globals: true,
    environment: 'jsdom',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
