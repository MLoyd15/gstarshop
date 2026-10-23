import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  cacheDir: join(tmpdir(), 'business-hub-vite-cache'),
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});
