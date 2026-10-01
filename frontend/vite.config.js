import { resolve, extname } from 'path';
import { cpSync, existsSync } from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    open: false,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    // Clean URL routing & SPA fallback middleware
    {
      name: 'spa-fallback-middleware',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = req.url ? req.url.split('?')[0] : '/';

          // Ignore Vite internals, static assets, scripts, styles, and backend proxies
          if (
            rawUrl.startsWith('/@') ||
            rawUrl.startsWith('/src') ||
            rawUrl.startsWith('/api') ||
            rawUrl.startsWith('/uploads') ||
            rawUrl.startsWith('/node_modules') ||
            extname(rawUrl) !== ''
          ) {
            return next();
          }

          // Route all application pages to index.html for React SPA
          req.url = '/index.html' + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
          return next();
        });
      },
    },
    // Copy static JS and CSS bundles during production build
    {
      name: 'copy-assets',
      closeBundle() {
        const jsDir = resolve(__dirname, 'js');
        const distJsDir = resolve(__dirname, 'dist/js');
        if (existsSync(jsDir)) {
          cpSync(jsDir, distJsDir, { recursive: true, force: true });
        }
        const cssDir = resolve(__dirname, 'css');
        const distCssDir = resolve(__dirname, 'dist/css');
        if (existsSync(cssDir)) {
          cpSync(cssDir, distCssDir, { recursive: true, force: true });
        }
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
});
