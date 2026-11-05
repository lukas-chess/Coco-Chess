import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { listFiles, computeVersion, buildServiceWorker } from './scripts/sw-builder.mjs';

// Erzeugt nach dem Build dist/sw.js mit der vollständigen Liste aller Dateien
// (inkl. Stockfish-Engine), damit die App komplett offline funktioniert.
function cocoServiceWorker() {
  let outDir = 'dist';
  return {
    name: 'coco-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      const template = fs.readFileSync(path.resolve('src/sw.template.js'), 'utf8');
      const sw = buildServiceWorker({ template, files, version: computeVersion(outDir, files) });
      fs.writeFileSync(path.join(outDir, 'sw.js'), sw);
      console.log(`[Coco Chess] sw.js erzeugt (${files.length} Dateien im Offline-Cache)`);
    },
  };
}

export default defineConfig({
  base: './', // relative Pfade: funktioniert auf GitHub Pages in jedem Unterordner
  plugins: [cocoServiceWorker()],
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
});
