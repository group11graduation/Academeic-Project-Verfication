const http = require('http');
const fs = require('fs');

function get(path, headers = {}) {
  return new Promise((resolve, reject) => {
    http
      .get(
        {
          hostname: '173.212.235.206',
          port: 8477,
          path,
          headers: {
            Accept: 'text/html',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            ...headers,
          },
          timeout: 30000,
        },
        (res) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () =>
            resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), ct: res.headers['content-type'] })
          );
        }
      )
      .on('error', reject);
  });
}

(async () => {
  const home = await get('/');
  console.log('HOME', home.status, home.ct, home.body.length, home.body.slice(0, 300).replace(/\n/g, ' '));
  const assets = [...home.body.matchAll(/\/assets\/[^"'\s>]+\.js/g)].map((m) => m[0]);
  console.log('ASSETS', assets);

  const dash = await get('/dashboard');
  console.log('DASH', dash.status, dash.ct, dash.body.length, {
    hasRoot: /id=["']root["']/.test(dash.body),
    shim: (dash.body.match(/__SV_LOGIN_FALLBACK_V\d+/) || [])[0],
    apiText: /API is running|Cannot GET/i.test(dash.body),
    title: (dash.body.match(/<title>[^<]+/) || [])[0],
  });

  // fetch without sec-fetch (like some clients)
  const dash2 = await get('/dashboard', { Accept: '*/*', 'Sec-Fetch-Dest': '', 'Sec-Fetch-Mode': '' });
  console.log('DASH */*', dash2.status, dash2.ct, dash2.body.length, dash2.body.slice(0, 200).replace(/\n/g, ' '));

  if (!assets[0]) return;
  const js = await get(assets[0], { Accept: '*/*' });
  fs.writeFileSync('d:/final-project/Verfication-Project-Using-Machine-Learning/backend-node/_blank_bundle.js', js.body);
  console.log('bundle', js.body.length);

  const s = js.body;
  const paths = new Set();
  for (const m of s.matchAll(/path:\s*[`'"]([^`'"]+)[`'"]/g)) paths.add(m[1]);
  for (const m of s.matchAll(/to:\s*[`'"](\/[^`'"]+)[`'"]/g)) paths.add(m[1]);
  for (const m of s.matchAll(/navigate\([`'"](\/[^`'"]+)[`'"]/g)) paths.add(m[1]);
  for (const m of s.matchAll(/[`'"](\/(?:dashboard|admin|manDash|login|home|panel)[^`'"]*)[`'"]/g)) paths.add(m[1]);
  console.log('PATHS', [...paths].filter((p) => p.length < 80).sort().slice(0, 80).join('\n'));

  // role checks
  for (const needle of ['SUPER_ADMIN', 'super_admin', '/dashboard', 'manDash', 'PrivateRoute', 'Navigate']) {
    const i = s.indexOf(needle);
    if (i >= 0) console.log('\n', needle, s.slice(i - 60, i + 160).replace(/\n/g, ' '));
  }
})();
