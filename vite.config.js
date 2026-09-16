import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function prunePublicSampleBackups() {
  return {
    name: 'prune-public-sample-backups',
    closeBundle() {
      const samplesDir = resolve(__dirname, 'dist', 'samples');
      let entries;

      try {
        entries = readdirSync(samplesDir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.endsWith('-old')) {
          rmSync(resolve(samplesDir, entry.name), { recursive: true, force: true });
        }
      }
    },
  };
}

export default defineConfig({
  base: '/arranger-demo/',
  plugins: [react(), prunePublicSampleBackups()],
});
