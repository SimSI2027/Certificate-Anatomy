import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// GitHub Pages serves the site from /Certificate-Anatomy/. Local dev uses /.
export const PAGES_BASE = '/Certificate-Anatomy/';

export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? (process.env.CA_BASE || PAGES_BASE) : '/',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0, // keep fixtures as real downloadable files
    rolldownOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        film: resolve(import.meta.dirname, 'film.html'),
      },
    },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    include: ['tests/unit/**/*.test.js', 'tests/integration/**/*.test.js'],
    environment: 'node',
  },
}));
