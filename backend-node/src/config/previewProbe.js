import fs from 'fs';

let cachedProbeHost = null;

/**
 * Hostname used to reach preview containers from the Node API process.
 * When node-backend runs in Docker, student preview containers publish ports on
 * the host daemon — not on the API container's loopback.
 */
export function getPreviewProbeHost() {
  if (cachedProbeHost) return cachedProbeHost;
  const configured = process.env.PREVIEW_PROBE_HOST?.trim();
  if (configured) {
    cachedProbeHost = configured;
    return cachedProbeHost;
  }
  cachedProbeHost = fs.existsSync('/.dockerenv') ? 'host.docker.internal' : '127.0.0.1';
  return cachedProbeHost;
}

export function previewProbeHostname(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1') {
    return getPreviewProbeHost();
  }
  return hostname;
}

/** Rewrite localhost preview URLs so HTTP/TCP probes work from inside Docker. */
export function rewritePreviewUrlForProbe(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.hostname = previewProbeHostname(u.hostname);
    return u.toString();
  } catch {
    const host = getPreviewProbeHost();
    return String(url)
      .replace(/^http:\/\/localhost(?=[:/])/i, `http://${host}`)
      .replace(/^http:\/\/127\.0\.0\.1(?=[:/])/i, `http://${host}`);
  }
}
