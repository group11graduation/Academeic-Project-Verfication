/**
 * Smoke-test: build + run a preview container without the full API.
 * Usage (from backend-node):  npm run preview:smoke
 * Requires Docker Desktop running.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  deployProjectPreview,
  stopProjectPreview,
} from '../src/services/dockerOrchestrator.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOT = path.join(BACKEND_ROOT, '.docker-smoke-fixture');

async function writeNodeFixture(dir) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify(
      {
        name: 'smoke-test-app',
        private: true,
        scripts: {
          start: 'npx --yes serve -s . -l 3000',
        },
      },
      null,
      2
    ),
    'utf8'
  );
  await fs.writeFile(
    path.join(dir, 'index.html'),
    '<!DOCTYPE html><html><body><h1>Docker preview smoke test OK</h1></body></html>',
    'utf8'
  );
}

async function main() {
  const stack = process.argv[2] || 'node-js';
  const projectId = `smoke-${Date.now()}`;

  console.log('Preparing fixture at', FIXTURE_ROOT);
  await fs.rm(FIXTURE_ROOT, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(FIXTURE_ROOT, { recursive: true });

  if (stack === 'node-js' || stack === 'node') {
    await writeNodeFixture(FIXTURE_ROOT);
  } else if (stack === 'php-apache' || stack === 'php') {
    await fs.writeFile(
      path.join(FIXTURE_ROOT, 'index.php'),
      '<?php echo "<h1>PHP smoke test OK</h1>";',
      'utf8'
    );
  } else if (stack === 'jupyter') {
    await fs.writeFile(
      path.join(FIXTURE_ROOT, 'demo.ipynb'),
      JSON.stringify(
        {
          cells: [],
          metadata: {},
          nbformat: 4,
          nbformat_minor: 5,
        },
        null,
        2
      ),
      'utf8'
    );
  } else {
    console.error('Unknown stack. Use: node-js | php-apache | jupyter');
    process.exit(1);
  }

  const resolvedStack = stack === 'node' ? 'node-js' : stack === 'php' ? 'php-apache' : stack;

  console.log(`Building and running container (stack=${resolvedStack})...`);
  const result = await deployProjectPreview(projectId, FIXTURE_ROOT, { stack: resolvedStack });

  console.log('\n--- Preview ready ---');
  console.log('URL:      ', result.previewUrl);
  console.log('Image:    ', result.imageTag);
  console.log('Container:', result.containerName);
  console.log('Ports:    ', `localhost:${result.hostPort} -> container:${result.internalPort}`);
  console.log('\nOpen the URL in your browser. Stop with:');
  console.log(`  docker rm -f ${result.containerName}`);
  console.log(`Or: npm run preview:smoke:stop -- ${projectId} ${result.hostPort}`);
}

main().catch((err) => {
  console.error('Smoke test failed:', err.message);
  if (err.stderr) console.error(err.stderr);
  process.exit(1);
});
