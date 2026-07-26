const http = require('http');
const fs = require('fs');

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '173.212.235.206',
        port: 8477,
        path,
        method: 'GET',
        headers: {
          Accept: 'text/html,application/xhtml+xml',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'User-Agent': 'Mozilla/5.0',
        },
        timeout: 20000,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            ct: res.headers['content-type'],
            len: data.length,
            head: data.slice(0, 400),
            hasRoot: /id=["']root["']/.test(data),
            hasShim: /__SV_LOGIN_FALLBACK/.test(data),
            isApiText: /API is running|Cannot GET/i.test(data),
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  for (const p of ['/', '/dashboard', '/login', '/admin/dashboard', '/manDash', '/index.html']) {
    try {
      console.log(p, await get(p));
    } catch (e) {
      console.log(p, 'ERR', e.message);
    }
  }

  // Fetch bundle for routes
  const home = await get('/');
  const m = home.head.match(/\/assets\/[^"'\s>]+\.js/) || String(home.head).match(/src="([^"]+\.js)"/);
  // better fetch full html
})();
