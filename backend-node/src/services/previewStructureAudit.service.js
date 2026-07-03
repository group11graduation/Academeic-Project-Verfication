import fs from 'fs/promises';
import path from 'path';
import * as dockerOrchestrator from './dockerOrchestrator.service.js';
import { resolveMernPair } from './previewMern.service.js';
import { resolveSpringReactPair } from './previewSpring.service.js';

async function countProjectFiles(root, depth = 0) {
  if (depth > 8) return 0;
  let count = 0;
  let entries;
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__MACOSX') continue;
    const full = path.join(root, entry.name);
    if (entry.isFile()) count += 1;
    else if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      count += await countProjectFiles(full, depth + 1);
    }
  }
  return count;
}

const BACKEND_ENTRY_FILES = ['server.js', 'index.js', 'app.js', 'main.js', 'server.ts', 'index.ts'];
const WEB_INDEX_PATHS = ['index.html', 'public/index.html', 'src/index.html', 'dist/index.html', 'build/index.html'];
const SPRING_BUILD_FILES = ['pom.xml', 'build.gradle', 'build.gradle.kts'];

async function pathExists(absPath) {
  try {
    await fs.access(absPath);
    return true;
  } catch {
    return false;
  }
}

async function hasWebEntry(absDir) {
  if (!(await pathExists(absDir))) return null;
  for (const rel of WEB_INDEX_PATHS) {
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(path.join(absDir, rel))) return rel;
  }
  return null;
}

async function findIndexHtmlAnywhere(root, maxDepth = 5) {
  async function walk(dir, depth) {
    if (depth > maxDepth) return null;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') continue;
      const full = path.join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'index.html') {
        return path.relative(root, full).replace(/\\/g, '/');
      }
      if (entry.isDirectory()) {
        // eslint-disable-next-line no-await-in-loop
        const hit = await walk(full, depth + 1);
        if (hit) return hit;
      }
    }
    return null;
  }
  return walk(root, 0);
}

async function hasBackendEntry(absDir) {
  for (const name of BACKEND_ENTRY_FILES) {
    // eslint-disable-next-line no-await-in-loop
    if (await pathExists(path.join(absDir, name))) return name;
  }
  const pkgPath = path.join(absDir, 'package.json');
  if (await pathExists(pkgPath)) {
    try {
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
      if (pkg.main && typeof pkg.main === 'string') {
        const mainAbs = path.join(absDir, pkg.main);
        if (await pathExists(mainAbs)) return pkg.main;
      }
      if (pkg.scripts?.start || pkg.scripts?.dev || pkg.scripts?.serve) {
        return 'package.json (start script)';
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function findSpringBackendRoot(buildContext) {
  async function walk(dir, relPrefix, depth) {
    if (depth > 6) return null;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const name of SPRING_BUILD_FILES) {
      if (await pathExists(path.join(dir, name))) {
        return relPrefix || '.';
      }
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'target') {
        continue;
      }
      const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      // eslint-disable-next-line no-await-in-loop
      const hit = await walk(path.join(dir, entry.name), rel, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  return walk(buildContext, '', 0);
}

function fail(failures, rule, message, filePath = '') {
  failures.push({ rule, message, path: filePath || undefined });
}

/**
 * Stack-aware checks for files required to run a Docker preview.
 * Returns teacher-facing messages the student can act on.
 */
export async function runPreviewStructureAudit(extractDir, { stackHint = '', stackOverride = null } = {}) {
  const failures = [];

  const fileCount = await countProjectFiles(extractDir);

  if (fileCount === 0) {
    fail(
      failures,
      'empty_archive',
      'The ZIP is empty or has no usable project files after extraction. Ask the student to re-zip their source code (not node_modules, .git, or an empty folder).'
    );
    return { passed: false, failures, stack: null, detection: null };
  }

  let detection;
  try {
    detection = await dockerOrchestrator.detectProjectStackWithMeta(extractDir, { stackHint });
  } catch (e) {
    fail(
      failures,
      'stack_undetected',
      e.message ||
        'Could not detect project type from the uploaded files. The student must include recognizable project files (index.html, package.json, pom.xml, index.php, or .ipynb).'
    );
    return { passed: false, failures, stack: null, detection: null };
  }

  const stack = stackOverride || detection.stack;

  if (stack === 'static-html' || stack === 'static-html-js') {
    const indexPath = await findIndexHtmlAnywhere(extractDir);
    if (!indexPath) {
      fail(
        failures,
        'missing_index_html',
        'Missing index.html — static sites need a main HTML page at the project root or in a subfolder. Without it the preview has nothing to display.',
        'index.html'
      );
    }
    if (stack === 'static-html-js') {
      const hasJs = await (async () => {
        async function walk(dir, depth) {
          if (depth > 6) return false;
          let entries;
          try {
            entries = await fs.readdir(dir, { withFileTypes: true });
          } catch {
            return false;
          }
          for (const entry of entries) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            const full = path.join(dir, entry.name);
            if (entry.isFile() && /\.(m?js|cjs)$/i.test(entry.name)) return true;
            if (entry.isDirectory()) {
              // eslint-disable-next-line no-await-in-loop
              if (await walk(full, depth + 1)) return true;
            }
          }
          return false;
        }
        return walk(extractDir, 0);
      })();
      if (!hasJs) {
        fail(
          failures,
          'missing_javascript',
          'HTML + JavaScript project is missing any .js file. The student should include their JavaScript source files in the ZIP.'
        );
      }
    }
  } else if (stack === 'php-apache') {
    let hasPhpEntry = false;
    let phpEntryPath = '';
    async function findPhpEntry(dir, relPrefix, depth) {
      if (depth > 4 || hasPhpEntry) return;
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (hasPhpEntry) return;
        const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (entry.isFile() && /^index\.php$/i.test(entry.name)) {
          hasPhpEntry = true;
          phpEntryPath = rel;
          return;
        }
      }
      for (const entry of entries) {
        if (hasPhpEntry) return;
        if (entry.isDirectory() && entry.name !== 'vendor' && entry.name !== 'node_modules') {
          const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
          // eslint-disable-next-line no-await-in-loop
          await findPhpEntry(path.join(dir, entry.name), rel, depth + 1);
        }
      }
    }
    await findPhpEntry(extractDir, '', 0);
    if (!hasPhpEntry) {
      fail(
        failures,
        'missing_php_entry',
        'PHP project is missing index.php (or a clear web entry point). The student should include the folder that Apache would serve, with index.php at the root of that site.',
        'index.php'
      );
    }
  } else if (stack === 'jupyter') {
    const hasNotebook = await (async () => {
      async function walk(dir, depth) {
        if (depth > 6) return false;
        let entries;
        try {
          entries = await fs.readdir(dir, { withFileTypes: true });
        } catch {
          return false;
        }
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isFile() && entry.name.toLowerCase().endsWith('.ipynb')) return true;
          if (entry.isDirectory() && entry.name !== 'node_modules') {
            // eslint-disable-next-line no-await-in-loop
            if (await walk(full, depth + 1)) return true;
          }
        }
        return false;
      }
      return walk(extractDir, 0);
    })();
    if (!hasNotebook) {
      fail(
        failures,
        'missing_notebook',
        'Jupyter project is missing a .ipynb notebook file. The student must include at least one notebook in the ZIP.'
      );
    }
  } else if (stack === 'java-spring-react') {
    const pair = await resolveSpringReactPair(extractDir);
    const springRoot = await findSpringBackendRoot(extractDir);

    if (!springRoot) {
      fail(
        failures,
        'missing_spring_backend',
        'Spring + React project is missing a Java backend (pom.xml or build.gradle). The student must include the Spring Boot folder, not only the React frontend.',
        'pom.xml'
      );
    }

    if (!pair) {
      if (springRoot) {
        fail(
          failures,
          'missing_react_frontend',
          `Spring backend found at "${springRoot}" but no separate React/frontend folder with package.json or index.html. The student should zip both backend and frontend (e.g. backend/ + frontend/ as sibling folders).`
        );
      }
    } else {
      const feAbs = path.join(extractDir, pair.frontendSubdir);
      const fePkg = path.join(feAbs, 'package.json');
      const webEntry = await hasWebEntry(feAbs);
      if (!(await pathExists(fePkg)) && !webEntry) {
        fail(
          failures,
          'missing_frontend_sources',
          `React frontend folder "${pair.frontendSubdir}" has no package.json and no index.html (or dist/build output). The student must include frontend source or a built dist/ folder.`,
          pair.frontendSubdir
        );
      }
      const beAbs = path.join(extractDir, pair.springSubdir);
      const hasPom = (await pathExists(path.join(beAbs, 'pom.xml'))) || (await pathExists(path.join(beAbs, 'build.gradle')));
      if (!hasPom) {
        fail(
          failures,
          'missing_spring_build_file',
          `Spring backend folder "${pair.springSubdir}" is missing pom.xml or build.gradle.`,
          pair.springSubdir
        );
      }
    }
  } else if (stack === 'node-js') {
    const mernPair = await resolveMernPair(extractDir);

    if (mernPair) {
      const feAbs = path.join(extractDir, mernPair.frontendSubdir);
      const fePkg = path.join(feAbs, 'package.json');
      const webEntry = await hasWebEntry(feAbs);
      if (!(await pathExists(fePkg)) && !webEntry) {
        fail(
          failures,
          'missing_frontend',
          `Frontend folder "${mernPair.frontendSubdir}" is missing package.json and has no index.html / dist / build. The student must include the React (or UI) project files.`,
          mernPair.frontendSubdir
        );
      }

      const beAbs = path.join(extractDir, mernPair.backendSubdir);
      const bePkg = path.join(beAbs, 'package.json');
      if (!(await pathExists(bePkg))) {
        fail(
          failures,
          'missing_backend_package',
          `Backend folder "${mernPair.backendSubdir}" is missing package.json. The student must include the API/server project.`,
          mernPair.backendSubdir
        );
      } else {
        const entry = await hasBackendEntry(beAbs);
        if (!entry) {
          fail(
            failures,
            'missing_backend_entry',
            `Backend folder "${mernPair.backendSubdir}" has package.json but no server entry file (server.js, index.js, app.js) and no npm start script. The preview cannot start the API.`,
            mernPair.backendSubdir
          );
        }
      }
    } else {
      const rootPkg = path.join(extractDir, 'package.json');
      const webEntry = await hasWebEntry(extractDir);
      const indexAnywhere = await findIndexHtmlAnywhere(extractDir);

      if (!(await pathExists(rootPkg))) {
        const nestedPkg = await (async () => {
          let entries;
          try {
            entries = await fs.readdir(extractDir, { withFileTypes: true });
          } catch {
            return null;
          }
          for (const entry of entries) {
            if (!entry.isDirectory() || entry.name === 'node_modules' || entry.name === '.git') continue;
            const pkg = path.join(extractDir, entry.name, 'package.json');
            // eslint-disable-next-line no-await-in-loop
            if (await pathExists(pkg)) return entry.name;
          }
          return null;
        })();

        if (!nestedPkg && !webEntry && !indexAnywhere) {
          fail(
            failures,
            'missing_node_project',
            'Node/React project is missing package.json and index.html. The student must include their app source (package.json at root or in a subfolder, or a static index.html).',
            'package.json'
          );
        }
      } else {
        const entry = await hasBackendEntry(extractDir);
        const hasUi = webEntry || indexAnywhere || (await pathExists(path.join(extractDir, 'src')));
        const pkg = JSON.parse(await fs.readFile(rootPkg, 'utf8').catch(() => '{}'));
        const isFrontendApp =
          pkg.dependencies?.react ||
          pkg.dependencies?.vite ||
          pkg.devDependencies?.react ||
          pkg.devDependencies?.vite ||
          pkg.scripts?.build;

        if (isFrontendApp && !hasUi && !entry) {
          fail(
            failures,
            'missing_frontend_entry',
            'React/Node app has package.json but no index.html, src/, or build/dist output. The student should include frontend source files or a production build folder.',
            'index.html'
          );
        }
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    stack,
    detection,
  };
}
