import { defineConfig, mergeConfig } from 'vite';
import config from './vite.config.js';

export default defineConfig(mergeConfig(config, {
  build: { outDir: 'dist/hum-preview', rolldownOptions: { input: 'hum-preview.html' } },
  optimizeDeps: { include: ['zustand', '@spotify/basic-pitch', '@tensorflow/tfjs', '@tensorflow/tfjs-backend-wasm'] },
  server: { host: '127.0.0.1', port: 5175, strictPort: true, open: false },
  preview: { host: '127.0.0.1', port: 5175, strictPort: true },
}));
