import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  base: '/schedules/',

  server: {
    host: '0.0.0.0',
    port: 5180,
    strictPort: true,

    allowedHosts: [
      'toriiminds.com',
      'www.toriiminds.com',
    ],

    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});