import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

function prunePublicSampleBackups() {
  let outputDir;
  return {
    name: 'prune-public-sample-backups',
    configResolved(config) {
      outputDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!outputDir || !existsSync(outputDir)) return;
      const samplesDir = resolve(outputDir, 'samples');
      function prune(directory) {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
          const path = resolve(directory, entry.name);
          if (entry.name === '.DS_Store'
            || (directory === samplesDir && entry.isDirectory() && entry.name.endsWith('-old'))) {
            rmSync(path, { recursive: true, force: true });
          } else if (entry.isDirectory()) {
            prune(path);
          }
        }
      }
      prune(outputDir);
    },
  };
}

export default defineConfig({
  base: '/arranger-demo/',
  plugins: [react(), prunePublicSampleBackups()],
});
