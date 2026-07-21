function parseOriginUrl(value) {
  if (!value || !String(value).trim()) return null;
  const raw = String(value).trim();
  try {
    return new URL(raw.includes('://') ? raw : `http://${raw}`);
  } catch {
    return null;
  }
}

function hostWithAnyPortPattern(hostname) {
  const escaped = hostname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^https?://${escaped}(:\\d+)?$`, 'i');
}

function collectConfiguredOrigins() {
  const defaultDevOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:4173',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:4173',
  ];
  const configuredOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
  return [...new Set([...defaultDevOrigins, ...configuredOrigins])];
}

function collectDynamicHostPatterns(configuredOrigins) {
  const patterns = [];
  const seenHosts = new Set();

  const addHost = (hostname) => {
    if (!hostname || seenHosts.has(hostname)) return;
    seenHosts.add(hostname);
    patterns.push(hostWithAnyPortPattern(hostname));
  };

  for (const key of ['PREVIEW_PUBLIC_HOST', 'FRONTEND_URL', 'PUBLIC_API_URL']) {
    const parsed = parseOriginUrl(process.env[key]);
    if (parsed?.hostname) addHost(parsed.hostname);
  }

  for (const origin of configuredOrigins) {
    if (origin === '*') continue;
    const parsed = parseOriginUrl(origin);
    if (!parsed?.hostname) continue;
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') continue;
    addHost(parsed.hostname);
  }

  return patterns;
}

export function buildCorsOptions() {
  const configuredOrigins = collectConfiguredOrigins();
  const allowAll = configuredOrigins.includes('*');
  const dynamicHostPatterns = collectDynamicHostPatterns(configuredOrigins);

  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      if (configuredOrigins.includes(origin)) return callback(null, true);
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return callback(null, true);
      }
      if (dynamicHostPatterns.some((pattern) => pattern.test(origin))) {
        return callback(null, true);
      }
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
}
