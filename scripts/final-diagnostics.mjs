import { chromium } from 'playwright';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OUT = '/Users/pedroaraujodasilva/pmo-licitacoes/out';
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.ico': 'image/x-icon' };

function makeHandler(root) {
  return (req, res) => {
    let urlPath = req.url;
    if (urlPath === '/' || urlPath === '/pmo-dashboard') urlPath = '/pmo-dashboard.html';
    let fp = join(root, urlPath);
    try {
      if (!statSync(fp).isFile()) { res.writeHead(404); res.end(); return; }
    } catch { res.writeHead(404); res.end(); return; }
    const content = readFileSync(fp);
    const ext = fp.match(/\.(\w+)$/)?.[1];
    res.writeHead(200, { 'Content-Type': MIME['.' + ext] || 'application/octet-stream' });
    res.end(content);
  };
}

const certDir = '/tmp/test-certs-final';
mkdirSync(certDir, { recursive: true });
execSync(
  'openssl req -x509 -newkey rsa:2048 -keyout ' + join(certDir, 'key.pem') +
  ' -out ' + join(certDir, 'cert.pem') + ' -days 1 -nodes -subj "/CN=localhost" 2>/dev/null',
  { stdio: 'ignore' }
);

const httpServer = createHttpServer(makeHandler(OUT));
const httpsServer = createHttpsServer(
  { key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')) },
  makeHandler(OUT)
);

const HTTP_PORT = 61920;
const HTTPS_PORT = 61921;

await new Promise(r => httpServer.listen(HTTP_PORT, r));
await new Promise(r => httpsServer.listen(HTTPS_PORT, r));
console.log('Servers: HTTP :' + HTTP_PORT + ', HTTPS :' + HTTPS_PORT);

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const ctxHttp = await browser.newContext();
const ctxHttps = await browser.newContext({ ignoreHTTPSErrors: true });

// ----- HTTP TEST -----
console.log('\n=== HTTP Test ===');
const httpPage = await ctxHttp.newPage();
httpPage.on('pageerror', err => console.log('  PAGE_ERROR:', err.message.substring(0, 200)));
httpPage.on('console', msg => {
  if (msg.type() === 'error') console.log('  CONSOLE_ERROR:', msg.text().substring(0, 200));
});

await httpPage.goto('http://localhost:' + HTTP_PORT + '/pmo-dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });

for (let j = 0; j < 8; j++) {
  await httpPage.waitForTimeout(3000);
  const s = await httpPage.evaluate((sec) => ({
    t: sec + 's',
    url: location.href.substring(0, 60),
    next: typeof window.next,
    nf: typeof self.__next_f,
    root: !!document.getElementById('__next'),
    spinner: !!(document.querySelector('.loading-spinner')?.offsetParent !== null),
    bodyDivs: document.body.children.length,
  }), (j + 1) * 3);
  console.log('  ' + s.t + ': next=' + s.next + ' root=' + s.root + ' sp=' + s.spinner + ' divs=' + s.bodyDivs + ' url=' + s.url);
  if (s.root || s.url.includes('/login')) { console.log('  HTTP: HIDRATOU!'); break; }
}

// ----- HTTPS TEST -----
console.log('\n=== HTTPS Test ===');
const httpsPage = await ctxHttps.newPage();
httpsPage.on('pageerror', err => console.log('  PAGE_ERROR:', err.message.substring(0, 200)));
httpsPage.on('console', msg => {
  if (msg.type() === 'error') console.log('  CONSOLE_ERROR:', msg.text().substring(0, 200));
});

await httpsPage.goto('https://localhost:' + HTTPS_PORT + '/pmo-dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });

for (let j = 0; j < 8; j++) {
  await httpsPage.waitForTimeout(3000);
  const s = await httpsPage.evaluate((sec) => ({
    t: sec + 's',
    url: location.href.substring(0, 60),
    next: typeof window.next,
    nf: typeof self.__next_f,
    root: !!document.getElementById('__next'),
    spinner: !!(document.querySelector('.loading-spinner')?.offsetParent !== null),
    bodyDivs: document.body.children.length,
    next_keys: window.next ? Object.keys(window.next) : [],
  }), (j + 1) * 3);
  console.log('  ' + s.t + ': next=' + s.next + '(' + s.next_keys.join(',') + ') root=' + s.root + ' sp=' + s.spinner + ' divs=' + s.bodyDivs + ' url=' + s.url);
  if (s.root || s.url.includes('/login')) { console.log('  HTTPS: HIDRATOU!'); break; }
}

// ----- DETAILED HTTPS CHECK -----
console.log('\n=== HTTPS Detailed Check ===');
const detail = await httpsPage.evaluate(() => {
  const r = {};
  r.bodyKids = Array.from(document.body.children).map((el) => ({
    tag: el.tagName,
    id: el.id || '',
    hidden: el.hidden,
    innerStart: el.innerHTML.substring(0, 80),
  }));
  r.TURBOPACK = typeof TURBOPACK;
  r.TURBOPACK_keys = TURBOPACK ? Object.keys(TURBOPACK) : [];
  r.allScripts = Array.from(document.scripts).map(s => ({
    src: s.src ? s.src.split('/').pop() : 'inline',
    async: s.async,
    finished: s.readyState === 'complete',
  }));
  r.__next_f_len = self.__next_f?.length || 0;
  return r;
});
console.log(JSON.stringify(detail, null, 2));

await browser.close();
httpServer.close();
httpsServer.close();
