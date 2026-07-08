import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

let cachedMounts = null;

function isWindowsAbsPath(p) {
  return /^[A-Za-z]:[\\/]/.test(String(p));
}

/** Format a path for `docker run -v` on the host daemon. */
function toDockerVolumePath(p) {
  if (isWindowsAbsPath(p)) {
    return String(p).replace(/\\/g, '/');
  }
  const resolved = path.resolve(p);
  if (process.platform === 'win32') {
    return resolved.replace(/\\/g, '/');
  }
  return resolved;
}

/** Join host paths without breaking Windows drive letters inside Linux containers. */
function joinHostPath(hostSource, ...segments) {
  const extra = segments.filter((s) => s && s !== '.');
  if (isWindowsAbsPath(hostSource)) {
    const base = String(hostSource).replace(/\\/g, '/').replace(/\/$/, '');
    if (!extra.length) return base;
    const tail = extra
      .map((s) => String(s).replace(/\\/g, '/').replace(/^\//, ''))
      .join('/');
    return `${base}/${tail}`;
  }
  return path.join(hostSource, ...extra);
}

/** Bind mounts for the current container (when API runs inside Docker with socket access). */
function getSelfBindMounts() {
  if (cachedMounts) return cachedMounts;
  try {
    const id = process.env.HOSTNAME || os.hostname();
    const raw = execSync(`docker inspect ${id} --format "{{json .Mounts}}"`, {
      encoding: 'utf8',
      timeout: 15_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(raw.trim());
    cachedMounts = Array.isArray(parsed) ? parsed : [];
  } catch {
    cachedMounts = [];
  }
  return cachedMounts;
}

/**
 * Map a path inside this container to a host path for `docker run -v`.
 * No-op when the path is already on the host (local Node) or no bind match exists.
 */
export function resolveDockerHostPath(containerPath) {
  const resolved = path.resolve(containerPath);
  const mounts = getSelfBindMounts();
  if (!mounts.length) {
    return toDockerVolumePath(resolved);
  }

  const sorted = [...mounts]
    .filter((m) => m.Type === 'bind' && m.Destination && m.Source)
    .sort((a, b) => b.Destination.length - a.Destination.length);

  for (const mount of sorted) {
    const dest = path.posix.resolve(mount.Destination.replace(/\\/g, '/'));
    const posixResolved = resolved.replace(/\\/g, '/');
    if (posixResolved !== dest && !posixResolved.startsWith(`${dest}/`)) continue;
    const rel = path.posix.relative(dest, posixResolved);
    const host =
      !rel || rel === '.'
        ? mount.Source
        : joinHostPath(mount.Source, rel);
    return toDockerVolumePath(host);
  }

  return toDockerVolumePath(resolved);
}
