import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        // Cache the networking library independently from game and UI changes.
        manualChunks(id) { if (id.includes('/node_modules/peerjs/')) return 'peerjs'; }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
