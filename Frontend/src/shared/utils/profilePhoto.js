/** Build a full URL for profile photos stored on User or TeacherProfile */

export function resolveProfilePhotoUrl(photo, apiOrigin = '') {
  const raw = String(photo || '').trim();
  if (!raw || raw === 'https://via.placeholder.com/150') return '';
  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
    return raw;
  }
  const origin = String(apiOrigin || '').replace(/\/$/, '');
  const path = raw.startsWith('/') ? raw : `/uploads/${raw.replace(/^\/+/, '')}`;
  return origin ? `${origin}${path}` : path;
}

export function teacherInitials(name) {
  const parts = String(name || 'T')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'T';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
