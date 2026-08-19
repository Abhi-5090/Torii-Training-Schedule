import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The API is proxied under /api so the session cookie is same-origin in dev
   and needs no cross-site relaxation. */
export default defineConfig({
  plugins: [react()],
  server: {
    /* 5173–5175 are usually taken by the other projects on this machine. */
    port: 5180,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
