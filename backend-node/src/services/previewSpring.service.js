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
      .filter((f) => {
        if (f.rel === spring.rel) return false;
        // Never treat a pure Express/Node API package as the Spring React frontend.
        if (f.role === 'backend' && f.hasExpress && !f.hasFrontend) return false;
        if (f.hasExpress && !f.hasFrontend && (f.frontendScore || 0) < 8) return false;
        return true;
      })
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
const LOMBOK_PREVIEW_VERSION = '1.18.32';

function dedupeConsecutiveXmlTags(xml, tag) {
  const re = new RegExp(`(<${tag}>[^<]*<\\/${tag}>)(\\s*<${tag}>[^<]*<\\/${tag}>)+`, 'g');
  return xml.replace(re, '$1');
}

function patchMavenPomXmlForPreview(content) {
  let next = dedupeConsecutiveXmlTags(String(content || ''), 'version');
  let changed = next !== content;

  if (/lombok/i.test(next) && !/<lombok\.version>\s*[\d.]+/i.test(next)) {
    if (/<properties>[\s\S]*?<\/properties>/i.test(next)) {
      next = next.replace(/<properties>/i, `<properties>\n    <lombok.version>${LOMBOK_PREVIEW_VERSION}</lombok.version>`);
    } else {
      next = next.replace(
        /<project(\s[^>]*)?>/i,
        `<project$1>\n  <properties>\n    <lombok.version>${LOMBOK_PREVIEW_VERSION}</lombok.version>\n  </properties>`
      );
    }
    changed = true;
  }

  const apFixed = next.replace(
    /(<annotationProcessorPaths>[\s\S]*?<path>[\s\S]*?<groupId>\s*org\.projectlombok\s*<\/groupId>\s*<artifactId>\s*lombok\s*<\/artifactId>)(\s*)(?:<version>[\s\S]*?<\/version>\s*)?(\s*<\/path>)/i,
    (match, head, _ws, tail) => {
      if (/<version>\s*(\$\{lombok\.version\}|[\d.]+)\s*<\/version>/i.test(match)) return match;
      changed = true;
      return `${head}\n                            <version>\${lombok.version}</version>${tail}`;
    }
  );
  next = apFixed;

  if (!/spring-boot-starter-data-jpa|com\.h2database/i.test(next) && /spring-boot-starter/i.test(next)) {
    next = next.replace(
      /<\/dependencies>/i,
      `    <dependency>
      <groupId>com.h2database</groupId>
      <artifactId>h2</artifactId>
      <scope>runtime</scope>
    </dependency>
  </dependencies>`
    );
    changed = true;
  }

  if (/<java\.version>\s*\d+\s*<\/java\.version>/i.test(next)) {
    next = next.replace(/<java\.version>\s*(\d+)\s*<\/java\.version>/i, (match, ver) => {
      if (Number(ver) > 17) {
        changed = true;
        return '<java.version>17</java.version>';
      }
      return match;
    });
  }
  if (/<maven\.compiler\.release>\s*\d+\s*<\/maven\.compiler\.release>/i.test(next)) {
    next = next.replace(
      /<maven\.compiler\.release>\s*\d+\s*<\/maven\.compiler\.release>/i,
      '<maven.compiler.release>17</maven.compiler.release>'
    );
    changed = true;
  }
  if (/<source>\s*(\d+)\s*<\/source>/i.test(next)) {
    next = next.replace(/<source>\s*\d+\s*<\/source>/gi, '<source>17</source>');
    changed = true;
  }
  if (/<target>\s*(\d+)\s*<\/target>/i.test(next)) {
    next = next.replace(/<target>\s*\d+\s*<\/target>/gi, '<target>17</target>');
    changed = true;
  }
  if (/--enable-preview/.test(next)) {
    next = next.replace(/\s*<compilerArgs>\s*--enable-preview\s*<\/compilerArgs>\s*/gi, '\n');
    changed = true;
  }

  const deduped = dedupeConsecutiveXmlTags(next, 'version');
  if (deduped !== next) {
    next = deduped;
    changed = true;
  }

  return { content: next, changed };
}

async function patchSpringSecurityCors(root) {
  const srcRoot = path.join(root, 'src', 'main', 'java');
  if (!(await pathExists(srcRoot))) return 0;
  const javaFiles = await walkJavaFiles(srcRoot, 400);
  let files = 0;
  for (const file of javaFiles) {
    let content = await fs.readFile(file, 'utf8');
    if (!content.includes('setAllowedOrigins') && !content.includes('setAllowedOriginPatterns')) continue;
    let changed = false;
    // Preview VPS teachers open UI at http://SERVER:UI_PORT — localhost-only CORS blocks that.
    const previewOrigins =
      'setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*", "http://*:*", "https://*:*"))';
    if (/setAllowedOrigins\s*\(\s*List\.of\s*\([^)]*\)\s*\)/.test(content)) {
      content = content.replace(/setAllowedOrigins\s*\(\s*List\.of\s*\([^)]*\)\s*\)/g, previewOrigins);
      changed = true;
    }
    if (/setAllowedOrigins\s*\(\s*Arrays\.asList\s*\([^)]*\)\s*\)/.test(content)) {
      content = content.replace(/setAllowedOrigins\s*\(\s*Arrays\.asList\s*\([^)]*\)\s*\)/g, previewOrigins);
      changed = true;
    }
    if (/setAllowedOriginPatterns\s*\(\s*List\.of\s*\([^)]*\)\s*\)/.test(content)) {
      content = content.replace(
        /setAllowedOriginPatterns\s*\(\s*List\.of\s*\([^)]*\)\s*\)/g,
        previewOrigins
      );
      changed = true;
    }
    if (changed) {
      await fs.writeFile(file, content, 'utf8');
      files += 1;
    }
  }
  return files;
}

function previewSeedCredentials() {
  return {
    username: process.env.PREVIEW_DEFAULT_ADMIN_USERNAME || 'previewadmin',
    password: process.env.PREVIEW_DEFAULT_ADMIN_PASSWORD || 'Preview123!',
  };
}

function parseJavaPackage(content) {
  const match = String(content || '').match(/^package\s+([\w.]+);/m);
  return match?.[1] || '';
}

function parseJavaImport(content, simpleName) {
  const re = new RegExp(`^import\\s+([\\w.]+\\.${simpleName});\\s*$`, 'm');
  const match = String(content || '').match(re);
  return match?.[1] || '';
}

async function detectSpringUserSeedHooks(root) {
  const srcRoot = path.join(root, 'src', 'main', 'java');
  if (!(await pathExists(srcRoot))) return null;

  const javaFiles = await walkJavaFiles(srcRoot, 500);
  let userService = null;
  let userRepo = null;
  let userEntity = null;
  let userEntityFqn = '';
  let configPackage = '';

  for (const file of javaFiles) {
    const base = path.basename(file);
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    const pkg = parseJavaPackage(content);
    if (!pkg) continue;

    if (base === 'UserService.java' && /class\s+UserService\b/.test(content)) {
      userService = { pkg, content, simple: 'UserService' };
      userEntityFqn = parseJavaImport(content, 'User') || userEntityFqn;
    } else if (
      /Repository\.java$/i.test(base) &&
      /interface\s+(\w+)\b/.test(content) &&
      /findByUsername\s*\(/.test(content) &&
      (/JpaRepository\s*<\s*User\b/.test(content) ||
        /CrudRepository\s*<\s*User\b/.test(content) ||
        /PagingAndSortingRepository\s*<\s*User\b/.test(content) ||
        /User\w*Repository/.test(base))
    ) {
      const iface = content.match(/interface\s+(\w+)\b/);
      if (iface) {
        userRepo = { pkg, content, simple: iface[1] };
        userEntityFqn = parseJavaImport(content, 'User') || userEntityFqn;
      }
    } else if (base === 'User.java' && /class\s+User\b/.test(content)) {
      userEntity = { pkg, content };
      if (!userEntityFqn) userEntityFqn = `${pkg}.User`;
    } else if (
      !configPackage &&
      /@Configuration/.test(content) &&
      /(Security|Cors|Config)/i.test(base)
    ) {
      configPackage = pkg;
    }
  }

  if (!userEntityFqn) return null;
  const canUseRepo = Boolean(userRepo);
  const canUseService =
    userService &&
    /existsByUsername\s*\(/.test(userService.content) &&
    /saveUser\s*\(/.test(userService.content);
  if (!canUseRepo && !canUseService) return null;

  const entityContent = userEntity?.content || '';
  return {
    configPackage:
      configPackage ||
      userRepo?.pkg ||
      userService?.pkg?.replace(/\.[^.]+$/, '.Configuration') ||
      'com.preview',
    userServiceFqn: userService ? `${userService.pkg}.UserService` : '',
    userServiceSimple: userService?.simple || '',
    userRepoFqn: userRepo ? `${userRepo.pkg}.${userRepo.simple}` : '',
    userRepoSimple: userRepo?.simple || '',
    userEntityFqn,
    userEntitySimple: 'User',
    // Default true when PasswordEncoder appears anywhere in UserService — helpers
    // like encodePassword() live outside the saveUser() body and used to be missed.
    serviceEncodesPassword: userService
      ? springSaveUserEncodesPassword(userService.content)
      : false,
    entityHasEmail: /\bsetEmail\s*\(/.test(entityContent),
    entityHasPhone: /\bsetPhone\s*\(/.test(entityContent),
    preferRepository: canUseRepo,
  };
}

/**
 * True when the student's UserService (or a helper it calls) encodes passwords.
 * Broad match on purpose — false negatives cause double-hash → permanent 401.
 */
export function springSaveUserEncodesPassword(serviceContent) {
  const content = String(serviceContent || '');
  if (/\bencodePassword\s*\(/.test(content)) return true;
  if (/passwordEncoder\s*\.\s*encode\s*\(/.test(content)) return true;
  if (/PasswordEncoder/.test(content) && /\.encode\s*\(\s*(?:user\.)?getPassword\s*\(\s*\)/.test(content)) {
    return true;
  }
  const idx = content.search(/\bsaveUser\s*\(/);
  if (idx < 0) return false;
  return /\.encode\s*\(/.test(content.slice(idx, idx + 1200));
}

async function writeSpringPreviewSeed(root, seed = previewSeedCredentials()) {
  const hooks = await detectSpringUserSeedHooks(root);
  if (!hooks) return null;

  const seedEmail = `${seed.username}@preview.demo`;
  // Prefer UserRepository + self-verify (encode → matches? else retry raw).
  const java = hooks.preferRepository
    ? buildRepositorySeedJava(hooks, seed, seedEmail)
    : buildUserServiceSeedJava(hooks, seed, seedEmail);

  const seedPath = path.join(
    root,
    'src',
    'main',
    'java',
    ...hooks.configPackage.split('.'),
    'ScholarVerifyPreviewSeed.java'
  );
  await fs.mkdir(path.dirname(seedPath), { recursive: true });
  await fs.writeFile(seedPath, java, 'utf8');
  return {
    ...seed,
    seedFile: 'ScholarVerifyPreviewSeed.java',
    via: hooks.preferRepository ? 'repository' : 'service',
  };
}

function seedFieldSetters(hooks, indent = '            ') {
  const emailLine = hooks.entityHasEmail ? `${indent}user.setEmail(email);\n` : '';
  const phoneLine = hooks.entityHasPhone ? `${indent}user.setPhone("0000000000");\n` : '';
  return { emailLine, phoneLine };
}

/**
 * Self-verifying repository seed.
 * 1) Save with passwordEncoder.encode(raw)
 * 2) Reload and passwordEncoder.matches(raw, stored)
 * 3) If false (entity @PrePersist / listener double-encoded), save RAW and re-check
 * Works whether findByUsername returns User or Optional<User>.
 */
function buildRepositorySeedJava(hooks, seed, seedEmail) {
  const { emailLine, phoneLine } = seedFieldSetters(hooks);
  return `package ${hooks.configPackage};

import ${hooks.userEntityFqn};
import ${hooks.userRepoFqn};
import java.util.Optional;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("preview")
public class ScholarVerifyPreviewSeed {

    @SuppressWarnings("unchecked")
    private static ${hooks.userEntitySimple} loadUser(${hooks.userRepoSimple} userRepository, String username) {
        Object found = userRepository.findByUsername(username);
        if (found instanceof Optional) {
            return ((Optional<${hooks.userEntitySimple}>) found).orElse(null);
        }
        return (${hooks.userEntitySimple}) found;
    }

    @Bean
    CommandLineRunner scholarVerifyPreviewAdminSeed(${hooks.userRepoSimple} userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            String username = System.getenv().getOrDefault("PREVIEW_SEED_USERNAME", "${seed.username}");
            String password = System.getenv().getOrDefault("PREVIEW_SEED_PASSWORD", "${seed.password}");
            String email = System.getenv().getOrDefault("PREVIEW_ADMIN_EMAIL", "${seedEmail}");

            ${hooks.userEntitySimple} user = loadUser(userRepository, username);
            if (user == null) {
                user = new ${hooks.userEntitySimple}();
            }
            user.setUsername(username);
${emailLine}${phoneLine}            user.setRole("ROLE_ADMIN");
            user.setPassword(passwordEncoder.encode(password));
            userRepository.save(user);

            ${hooks.userEntitySimple} loaded = loadUser(userRepository, username);
            boolean ok = loaded != null && loaded.getPassword() != null
                && passwordEncoder.matches(password, loaded.getPassword());
            if (!ok && loaded != null) {
                System.out.println("[preview-seed] encoded password did not match — retrying with RAW password (listener/entity may encode)");
                loaded.setPassword(password);
                userRepository.save(loaded);
                loaded = loadUser(userRepository, username);
                ok = loaded != null && loaded.getPassword() != null
                    && passwordEncoder.matches(password, loaded.getPassword());
            }
            System.out.println("[preview-seed] upserted admin username=" + username
                + " via ${hooks.userRepoSimple} passwordMatches=" + ok);
        };
    }
}
`;
}

function buildUserServiceSeedJava(hooks, seed, seedEmail) {
  // Prefer RAW when the service looks like it encodes — then verify via a second
  // attempt with pre-encoded if we can re-save (exists check skipped on retry by delete pattern).
  // Without a repository we can't reliably re-read; pass RAW when encode helpers exist,
  // otherwise encode here.
  const passwordExpr = hooks.serviceEncodesPassword
    ? 'password'
    : 'passwordEncoder.encode(password)';
  const { emailLine, phoneLine } = seedFieldSetters(hooks);
  return `package ${hooks.configPackage};

import ${hooks.userEntityFqn};
import ${hooks.userServiceFqn};
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@Profile("preview")
public class ScholarVerifyPreviewSeed {

    @Bean
    CommandLineRunner scholarVerifyPreviewAdminSeed(${hooks.userServiceSimple} userService, PasswordEncoder passwordEncoder) {
        return args -> {
            String username = System.getenv().getOrDefault("PREVIEW_SEED_USERNAME", "${seed.username}");
            String password = System.getenv().getOrDefault("PREVIEW_SEED_PASSWORD", "${seed.password}");
            String email = System.getenv().getOrDefault("PREVIEW_ADMIN_EMAIL", "${seedEmail}");
            if (userService.existsByUsername(username)) {
                System.out.println("[preview-seed] admin username=" + username + " already exists — leaving as-is");
                return;
            }
            ${hooks.userEntitySimple} user = new ${hooks.userEntitySimple}();
            user.setUsername(username);
${emailLine}${phoneLine}            user.setPassword(${passwordExpr});
            user.setRole("ROLE_ADMIN");
            userService.saveUser(user);
            System.out.println("[preview-seed] created admin username=" + username
                + " via UserService (encodeInService=${hooks.serviceEncodesPassword})");
        };
    }
}
`;
}

export async function patchSpringForPreview(extractDir, springSubdir, { apiHostPort, uiHostPort, publicUiUrl } = {}) {
  const root = path.join(extractDir, springSubdir);
  if (!(await pathExists(root))) return { files: 0 };

  let files = 0;
  const pomPath = path.join(root, 'pom.xml');
  if (await pathExists(pomPath)) {
    const pomRaw = await fs.readFile(pomPath, 'utf8');
    const pomPatch = patchMavenPomXmlForPreview(pomRaw);
    if (pomPatch.changed) {
      await fs.writeFile(pomPath, pomPatch.content, 'utf8');
      files += 1;
    }
  }

  const overlay = [
    '# ScholarVerify preview overlay',
    'server.port=8080',
    'server.address=0.0.0.0',
    'spring.main.banner-mode=off',
    'management.endpoints.web.exposure.include=health',
  ];
  const corsOrigins = [];
  if (uiHostPort) {
    corsOrigins.push(`http://localhost:${uiHostPort}`, `http://127.0.0.1:${uiHostPort}`);
  }
  if (publicUiUrl) {
    corsOrigins.push(String(publicUiUrl).replace(/\/$/, ''));
  }
  if (corsOrigins.length) {
    overlay.push(`app.cors.allowed-origins=${[...new Set(corsOrigins)].join(',')}`);
  }
  // Broad preview CORS for custom SecurityConfig apps that read a pattern prop.
  overlay.push('app.cors.allowed-origin-patterns=http://localhost:*,http://127.0.0.1:*,http://*:*,https://*:*');
  // HS512 needs >= 512-bit key after Base64 decode (see JwtTokenProvider WeakKeyException).
  const previewJwtSecret =
    process.env.PREVIEW_JWT_SECRET ||
    'cHJldmlldy1zYW5kYm94LWp3dC1zZWNyZXQtZm9yLUhTNTEyLW5lZWRzLTY0LWJ5dGUta2V5LW1pbmltdW0hIQ==';
  overlay.push(
    'spring.datasource.url=jdbc:h2:mem:scholarverify_preview;DB_CLOSE_DELAY=-1;MODE=PostgreSQL',
    'spring.datasource.driver-class-name=org.h2.Driver',
    'spring.datasource.username=sa',
    'spring.datasource.password=',
    'spring.jpa.hibernate.ddl-auto=update',
    'spring.jpa.database-platform=org.hibernate.dialect.H2Dialect',
    'spring.h2.console.enabled=false',
    `jwt.secret=${previewJwtSecret}`,
    'jwt.expirationMs=86400000',
    'spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.mongo.MongoAutoConfiguration,org.springframework.boot.autoconfigure.data.mongo.MongoDataAutoConfiguration,org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration'
  );
  overlay.push('');

  const propsPath = path.join(root, 'src', 'main', 'resources', 'application-preview.properties');
  await fs.mkdir(path.dirname(propsPath), { recursive: true });
  await fs.writeFile(propsPath, overlay.join('\n'), 'utf8');
  files += 1;

  files += await patchSpringSecurityCors(root);

  const appProps = path.join(root, 'src', 'main', 'resources', 'application.properties');
  if (await pathExists(appProps)) {
    let content = await fs.readFile(appProps, 'utf8');
    let propsChanged = false;
    if (!/spring\.profiles\.active/.test(content)) {
      content += '\nspring.profiles.active=preview\n';
      propsChanged = true;
    }
    if (/server\.port\s*=\s*\d+/.test(content)) {
      content = content.replace(/server\.port\s*=\s*\d+/g, 'server.port=8080');
      propsChanged = true;
    }
    if (propsChanged) {
      await fs.writeFile(appProps, content, 'utf8');
      files += 1;
    }
  }

  const seedCredentials = await writeSpringPreviewSeed(root);
  if (seedCredentials) files += 1;

  return {
    files,
    apiPort: 8080,
    seedCredentials: seedCredentials
      ? {
          username: seedCredentials.username,
          password: seedCredentials.password,
          hint: 'Preview admin auto-seeded in Spring H2 database on first start.',
        }
      : null,
  };
}

const SPRING_DEFAULT_LOGIN_PATHS = [
  '/api/auth/login',
  '/auth/login',
  '/api/login',
  '/login',
  '/api/users/login',
  '/users/login',
  '/api/user/login',
  '/api/v1/auth/login',
];

/**
 * Find Spring @PostMapping / @RequestMapping login routes for preview login verify.
 */
export async function discoverSpringLoginApiPaths(extractDir, springSubdir = '.') {
  const found = new Set(SPRING_DEFAULT_LOGIN_PATHS);
  const root = path.join(extractDir, springSubdir === '.' ? '' : springSubdir);
  const srcRoot = path.join(root, 'src', 'main', 'java');
  if (!(await pathExists(srcRoot))) return [...found];

  const javaFiles = await walkJavaFiles(srcRoot, 400);
  const mappingRe =
    /@(?:Post|Request)Mapping\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?["']([^"']*login[^"']*)["']/gi;

  for (const file of javaFiles) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf8');
    } catch {
      continue;
    }
    if (!/login/i.test(content)) continue;
    let match;
    mappingRe.lastIndex = 0;
    while ((match = mappingRe.exec(content)) !== null) {
      const p = match[1];
      if (p) found.add(p.startsWith('/') ? p : `/${p}`);
    }
  }
  return [...found];
}
