import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin trick: proxy /api to the existing Next BA server on :3030.
    // This sidesteps the cross-origin cookie/CORS dance — from the browser's
    // view, the BA cookie set by /api/auth/sign-up is auto-attached to
    // /api/insforge-token, just like in the Next-only setup.
    proxy: {
      '/api': {
        target: 'http://localhost:3030',
        changeOrigin: true,
        configure: (proxy) => {
          // Rewrite Origin so BA's CSRF check (which compares Origin against
          // its baseURL) sees its own URL. Without this, sign-out and other
          // state-changing endpoints return 403 because the browser's Origin
          // is the Vite SPA (:5173), not the BA server (:3030).
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('origin', 'http://localhost:3030');
          });
        },
      },
    },
  },
});
