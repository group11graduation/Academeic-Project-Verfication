import fs from 'fs/promises';
import path from 'path';
import { classifyPackageJson, collectPackages } from './previewMern.service.js';

const SPRING_DIR_HINTS = [
  'backend',
  'Backend',
  'server',
  'api',
  'API',
  'spring-boot',
  'springboot',
  'spring',
];

const FRONTEND_DIR_HINTS = [
  'frontend',
  'Frontend',
  'client',
  'Client',
  'web',
  'ui',
  'app',
  'react-app',
  'reactapp',
];

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function dirHintScore(rel, hints) {
  const base = rel.split('/').pop()?.toLowerCase() || '';
  const full = rel.toLowerCase();
  for (const hint of hints) {
    const h = hint.toLowerCase();
    if (base === h || full.endsWith(`/${h}`)) return 14;
    if (base.includes(h) || full.includes(h)) return 7;
  }
  return 0;
}

async function readTextHead(filePath, max = 8000) {
  try {
    const fh = await fs.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(max);
      const { bytesRead } = await fh.read(buf, 0, max, 0);
      return buf.subarray(0, bytesRead).toString('utf8');
    } finally {
      await fh.close();
    }
  } catch {
    return '';
  }
}

async function isSpringBootProject(dirAbs) {
  const pom = path.join(dirAbs, 'pom.xml');
  if (await pathExists(pom)) {
    const text = await readTextHead(pom, 12000);
    if (/spring-boot/i.test(text)) return { kind: 'maven', score: 20 };
    if (/<artifactId>/.test(text)) return { kind: 'maven', score: 12 };
  }
  for (const name of ['build.gradle', 'build.gradle.kts', 'settings.gradle', 'settings.gradle.kts']) {
    const gradle = path.join(dirAbs, name);
    if (await pathExists(gradle)) {
      const text = await readTextHead(gradle, 12000);
      if (/spring-boot|org\.springframework\.boot/i.test(text)) return { kind: 'gradle', score: 20 };
      if (/springframework/i.test(text)) return { kind: 'gradle', score: 14 };
      return { kind: 'gradle', score: 10 };
    }
  }
  const srcMain = path.join(dirAbs, 'src', 'main', 'java');
  if (await pathExists(srcMain)) {
    const javaFiles = await walkJavaFiles(srcMain, 24);
    for (const jf of javaFiles) {
      const text = await readTextHead(jf, 4000);
      if (/@SpringBootApplication/.test(text)) {
        return { kind: 'java', score: 18 };
      }
    }
  }
  return null;
}

async function walkJavaFiles(dir, limit = 20, found = []) {
  if (found.length >= limit) return found;
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (found.length >= limit) break;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      await walkJavaFiles(full, limit, found);
    } else if (entry.isFile() && entry.name.endsWith('.java')) {
      found.push(full);
    }
  }
  return found;
}

async function collectSpringCandidates(buildContext, dir, found, depth = 0) {
  if (depth > 6 || found.length > 20) return;
  const rel = path.relative(buildContext, dir).replace(/\\/g, '/') || '.';
  // eslint-disable-next-line no-await-in-loop
  const meta = await isSpringBootProject(dir);
  if (meta) {
    found.push({
      rel,
      ...meta,
      score: meta.score + dirHintScore(rel, SPRING_DIR_HINTS),
    });
  }
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    await collectSpringCandidates(buildContext, path.join(dir, entry.name), found, depth + 1);
  }
}

export function springReactDisplayLabel(pair) {
  if (!pair) return 'React + Spring Boot';
  return `React + Spring Boot (${pair.springSubdir} + ${pair.frontendSubdir})`;
}

/**
 * Locate Spring Boot backend + React/Vite frontend folders (no Node API required).
 */
export async function resolveSpringReactPair(buildContext) {
  const springDirs = [];
  await collectSpringCandidates(buildContext, buildContext, springDirs);
  if (!springDirs.length) return null;

  const packages = [];
  await collectPackages(buildContext, buildContext, packages);
  const frontendCandidates = packages.filter(
    (p) => p.role === 'frontend' || p.role === 'fullstack' || p.hasFrontend || p.frontendScore >= 12
  );

  springDirs.sort((a, b) => b.score - a.score);
  const spring = springDirs[0];

  let frontend = null;
  if (frontendCandidates.length) {
    frontend = [...frontendCandidates]
      .filter((f) => f.rel !== spring.rel)
      .sort(
        (a, b) =>
          b.frontendScore +
          dirHintScore(b.rel, FRONTEND_DIR_HINTS) -
          (a.frontendScore + dirHintScore(a.rel, FRONTEND_DIR_HINTS))
      )[0];
  }

  if (!frontend) {
    const parent = spring.rel === '.' ? buildContext : path.dirname(path.join(buildContext, spring.rel));
    const searchRoot = parent;
    const entries = await fs.readdir(searchRoot, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
        continue;
      }
      const rel =
        spring.rel === '.'
          ? entry.name
          : `${path.dirname(spring.rel).replace(/\\/g, '/')}/${entry.name}`.replace(/^\.\//, '');
      if (rel === spring.rel) continue;
      const abs = path.join(buildContext, rel);
      const pkg = path.join(abs, 'package.json');
      // eslint-disable-next-line no-await-in-loop
      if (await pathExists(pkg)) {
        try {
          const meta = classifyPackageJson(JSON.parse(await fs.readFile(pkg, 'utf8')));
          if (meta.hasFrontend || meta.frontendScore >= 10) {
            frontend = { rel, frontendFramework: meta.frontendFramework || 'React' };
            break;
          }
        } catch {
          /* ignore */
        }
      }
      // eslint-disable-next-line no-await-in-loop
      if (await pathExists(path.join(abs, 'index.html'))) {
        frontend = { rel, frontendFramework: 'React' };
        break;
      }
    }
  }

  if (!frontend || frontend.rel === spring.rel) return null;

  return {
    springSubdir: spring.rel,
    backendSubdir: spring.rel,
    frontendSubdir: frontend.rel,
    springKind: spring.kind,
    frontendFramework: frontend.frontendFramework || 'React',
    detectionNote: springReactDisplayLabel({
      springSubdir: spring.rel,
      frontendSubdir: frontend.rel,
    }),
  };
}

/**
 * Patch Spring Boot config for preview (port 8080, permissive CORS, in-memory H2 when JDBC points to localhost).
 */
export async function patchSpringForPreview(extractDir, springSubdir, { apiHostPort, uiHostPort } = {}) {
  const root = path.join(extractDir, springSubdir);
  if (!(await pathExists(root))) return { files: 0 };

  let files = 0;
  const overlay = [
    '# ScholarVerify preview overlay',
    'server.port=8080',
    'server.address=0.0.0.0',
    'spring.main.banner-mode=off',
    'management.endpoints.web.exposure.include=health',
  ];
  if (uiHostPort) {
    overlay.push(`app.cors.allowed-origins=http://localhost:${uiHostPort}`);
  }
  overlay.push(
    'spring.datasource.url=jdbc:h2:mem:scholarverify_preview;DB_CLOSE_DELAY=-1;MODE=MySQL',
    'spring.datasource.driver-class-name=org.h2.Driver',
    'spring.datasource.username=sa',
    'spring.datasource.password=',
    'spring.jpa.hibernate.ddl-auto=update',
    'spring.h2.console.enabled=false'
  );
  overlay.push('');

  const propsPath = path.join(root, 'src', 'main', 'resources', 'application-preview.properties');
  await fs.mkdir(path.dirname(propsPath), { recursive: true });
  await fs.writeFile(propsPath, overlay.join('\n'), 'utf8');
  files += 1;

  const appProps = path.join(root, 'src', 'main', 'resources', 'application.properties');
  if (await pathExists(appProps)) {
    let content = await fs.readFile(appProps, 'utf8');
    if (!content.includes('spring.profiles.active')) {
      content += '\nspring.profiles.active=preview\n';
      await fs.writeFile(appProps, content, 'utf8');
      files += 1;
    }
  }

  return { files, apiPort: 8080 };
}
