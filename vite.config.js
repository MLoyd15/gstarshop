import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  cacheDir: join(tmpdir(), 'business-hub-vite-cache'),
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});
