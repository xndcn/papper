import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    target: 'ES2022',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
    assetsInlineLimit: 0,
  },
  assetsInclude: ['**/*.aseprite', '**/*.tmj', '**/*.tsx'],
  // PWA integration is intentionally deferred to Phase 5 to avoid HMR interference.
});
