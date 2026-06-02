import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function normalizeUrl(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = normalizeUrl(env.VITE_BACKEND_URL || 'http://localhost:3001');

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true
        },
        '/socket.io': {
          target: backendUrl,
          changeOrigin: true,
          ws: true
        }
      }
    }
  };
});
