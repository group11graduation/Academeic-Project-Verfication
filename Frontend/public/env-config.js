// Overwritten at container startup on the server (see Frontend/docker-entrypoint.sh).
// Empty string means: use the same origin as the browser (when /api is reverse-proxied).
window.__APP_CONFIG__ = window.__APP_CONFIG__ || {};
window.__APP_CONFIG__.API_URL = '';
