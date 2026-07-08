#!/usr/bin/env node
/**
 * Step 3 — Docker socket + upload path integration diagnostic.
 *
 * Run INSIDE the node-backend container:
 *   docker compose exec node-backend node scripts/docker-integration-diagnostic.js
 *
 * Or locally (requires Docker on host):
 *   cd backend-node && node scripts/docker-integration-diagnostic.js
 */
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { getUploadDir, uploadPath } from '../src/config/env.js';
import { resolveDockerHostPath } from '../src/config/dockerPaths.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PASS = '✓ PASS';
const FAIL = '✗ FAIL';

function log(section, msg) {
  console.log(`\n[${section}] ${msg}`);
}

function pass(label, detail = '') {
  console.log(`  ${PASS} ${label}${detail ? ` — ${detail}` : ''}`);
}

function fail(label, detail = '') {
  console.error(`  ${FAIL} ${label}${detail ? ` — ${detail}` : ''}`);
  return false;
}

async function runDocker(args, timeoutMs = 120_000) {
  const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  return execFileAsync('docker', args, {
    timeout: timeoutMs,
    env: { ...process.env, DOCKER_HOST: `unix://${socket}` },
    maxBuffer: 4 * 1024 * 1024,
  });
}

/** Resolve host-side source path for a bind mount (Linux containers only). */
function resolveBindSource(mountPoint) {
  try {
    const info = fs.readFileSync('/proc/self/mountinfo', 'utf8');
    const normalized = mountPoint.replace(/\/$/, '');
    for (const line of info.split('\n')) {
      const parts = line.split(' ');
      const idx = parts.indexOf('-');
      if (idx < 0) continue;
      const mountPath = parts[1];
      if (mountPath !== normalized && !mountPath.startsWith(`${normalized}/`)) continue;
      const fstype = parts[idx + 1];
      if (fstype !== 'bind') continue;
      return parts[idx + 2];
    }
  } catch {
    /* not in Linux container */
  }
  return null;
}

async function checkSocketFile() {
  log('1/5', 'Docker socket file');
  const socket = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
  if (!fs.existsSync(socket)) {
    return fail('Socket missing', `${socket} — mount /var/run/docker.sock in compose`);
  }
  pass('Socket present', socket);
  return true;
}

async function checkDockerPing() {
  log('2/5', 'Docker daemon reachability');
  try {
    const { stdout } = await runDocker(['version', '--format', '{{.Server.Version}}'], 30_000);
    pass('docker version', `Server ${stdout.trim()}`);
    return true;
  } catch (e) {
    return fail('docker version', e.message);
  }
}

async function checkHelloWorld() {
  log('3/5', 'docker run privilege (hello-world)');
  const name = `scholarverify-diagnostic-${Date.now()}`;
  try {
    await runDocker(
      ['run', '--rm', '--name', name, 'hello-world'],
      120_000
    );
    pass('hello-world container ran and exited cleanly');
    return true;
  } catch (e) {
    return fail('hello-world', e.message);
  }
}

async function checkUploadVolume() {
  log('4/5', 'Upload volume visibility');
  const uploadDir = getUploadDir();
  const marker = uploadPath('integration-diagnostic.txt');
  const payload = `scholarverify-step3-${new Date().toISOString()}\n`;

  try {
    await fsPromises.mkdir(uploadDir, { recursive: true });
    await fsPromises.writeFile(marker, payload, 'utf8');
    const readBack = await fsPromises.readFile(marker, 'utf8');
    if (!readBack.includes('scholarverify-step3')) {
      return fail('Upload write/read', 'content mismatch');
    }
    pass('Write/read inside API container', marker);

    const bindSource = resolveDockerHostPath(uploadDir);
    if (bindSource && bindSource !== uploadDir.replace(/\\/g, '/')) {
      pass('Bind-mount host source (docker inspect)', bindSource);
      console.log(
        '    → Use THIS host path in docker run -v when testing from inside the container.'
      );
    } else {
      const mountinfoSource = resolveBindSource(uploadDir);
      if (mountinfoSource) {
        pass('Bind-mount host source (from /proc/self/mountinfo)', mountinfoSource);
      } else {
        console.log(
          '    → On host, verify file exists at repo ./uploads/integration-diagnostic.txt'
        );
      }
    }
    return true;
  } catch (e) {
    return fail('Upload volume', e.message);
  }
}

async function checkBindMountIntoChild() {
  log('5/5', 'Bind-mount from orchestrator into child container');
  const uploadDir = getUploadDir();
  const testDir = uploadPath('diagnostic-bind-test');
  const testFile = path.join(testDir, 'probe.txt');

  try {
    await fsPromises.mkdir(testDir, { recursive: true });
    await fsPromises.writeFile(testFile, 'bind-ok', 'utf8');

    const hostPath = resolveDockerHostPath(testDir);

    const childName = `scholarverify-bind-${Date.now()}`;
    const { stdout } = await runDocker(
      [
        'run',
        '--rm',
        '--name',
        childName,
        '-v',
        `${hostPath}:/probe:ro`,
        'alpine:3.20',
        'cat',
        '/probe/probe.txt',
      ],
      120_000
    );

    if (stdout.trim() !== 'bind-ok') {
      return fail('Child could not read bind-mounted file', stdout);
    }
    pass('Child container read host-mounted upload path', `via -v ${hostPath}:/probe`);
    return true;
  } catch (e) {
    fail('Bind-mount test', e.message);
    console.log(
      '    Hint: On Docker Desktop (Windows), ensure compose maps ./uploads:/app/uploads and',
    );
    console.log(
      '    that docker run uses the HOST path from: docker inspect scholarverify-node-backend --format "{{json .Mounts}}"'
    );
    return false;
  }
}

async function checkUpstreamServices() {
  log('Bonus', 'Upstream service env (run from host curl for HTTP checks)');
  console.log(`  MONGO_URI=${process.env.MONGO_URI || process.env.MONGODB_URI || '(unset)'}`);
  console.log(`  AI_SERVICE_URL=${process.env.AI_SERVICE_URL || '(unset)'}`);
  console.log(`  UPLOAD_DIR=${getUploadDir()}`);
  console.log(`  DOCKER_PREVIEW_ENABLED=${process.env.DOCKER_PREVIEW_ENABLED ?? '(unset)'}`);
}

async function main() {
  console.log('=== ScholarVerify Step 3 — Docker integration diagnostic ===\n');
  const results = [];

  results.push(await checkSocketFile());
  results.push(await checkDockerPing());
  results.push(await checkHelloWorld());
  results.push(await checkUploadVolume());
  results.push(await checkBindMountIntoChild());
  await checkUpstreamServices();

  const ok = results.every(Boolean);
  console.log('\n=== Summary ===');
  if (ok) {
    console.log(`${PASS} All core Docker integration checks passed.`);
    console.log('Next: docker compose exec node-backend node scripts/docker-preview-smoke.js node-js');
    process.exit(0);
  }
  console.log(`${FAIL} One or more checks failed — fix socket/volume/path issues before preview E2E.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
