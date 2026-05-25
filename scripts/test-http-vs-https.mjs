import { chromium } from 'playwright';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync, mkdirSync, statSync } from 'fs';
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
    } catch(e) { res.writeHead(404); res.end(); return; }
    const content = readFileSync(fp);
    const ext = fp.match(/\.(\w+)$/)?.[1];
    res.writeHead(200, { 'Content-Type': MIME['.' + ext] || 'application/octet-stream' });
    res.end(content);
  };
}

// Create cert for HTTPS
const certDir = '/tmp/test-certs-httpstest';
mkdirSync(certDir, { recursive: true });
execSync(
  'openssl req -x509 -newkey rsa:2048 -keyout ' + join(certDir, 'key.pem') +
  ' -out ' + join(certDir, 'cert.pem') + ' -days 1 -nodes -subj "/CN=localhost" 2>/dev/null',
  { stdio: 'ignore' }
);

// Start both servers
const httpServer = createHttpServer(makeHandler(OUT));
const httpsServer = createHttpsServer(
  { key: readFileSync(join(certDir, 'key.pem')), cert: readFileSync(join(certDir, 'cert.pem')) },
  makeHandler(OUT)
);

const HTTP_PORT = 61910;
const HTTPS_PORT = 61911;

await new Promise(r => httpServer.listen(HTTP_PORT, r));
await new Promise(r => httpsServer.listen(HTTPS_PORT, r));
console.log('HTTP on :' + HTTP_PORT + ', HTTPS on :' + HTTPS_PORT);

// Test function
async function testServer(label, url) {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ ignoreHTTPSErrors: label.includes('HTTPS') });
  const page = await ctx.newPage();

  let errors = [];
  page.on('pageerror', err => errors.push(err.message.substring(0, 150)));
  page.on('console', msg => {
    const t = msg.text().substring(0, 150);
    if (msg.type() === 'error') errors.push(t);
    if (t.includes('next') || t.includes('TURBOPACK') || t.includes('module') || t.includes('error'))
      console.log(label + ' CONSOLE[' + msg.type() + ']:', t);
  });

  console.log(label + ': loading ' + url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  let ok = false;
  for (let j = 0; j < 6; j++) {
    await page.waitForTimeout(3000);
    const s = await page.evaluate((sec) => ({
      elapsed: sec + 's',
      url: location.href.substring(0, 60),
      root: !!document.getElementById('__next'),
      next: typeof window.next,
      next_keys: window.next ? Object.keys(window.next) : [],
      next_turbopack: window.next?.turbopack,
      next_v: window.next?.version,
      react: typeof window.React,
      domex: typeof window.ReactDOM,
      nf: typeof self.__next_f,
      spinner: !!(document.querySelector('.loading-spinner')?.offsetParent !== null),
      bodyDivs: document.body.children.length,
    }), (j + 1) * 3);
    console.log(label + ' ' + s.elapsed + ': root=' + s.root + ' next=' + s.next + '(' + (s.next_keys||[]).join(',') + ') spinner=' + s.spinner + ' divs=' + s.bodyDivs);
    if (s.root || s.url.includes('/login')) { ok = true; break; }
  }

  console.log(label + ': ' + (ok ? 'PASS' : 'FAIL') + ' errors=' + errors.length);
  errors.slice(0, 3).forEach(e => console.log('  err:', e));

  // Dump DOM for analysis
  if (!ok) {
    const dump = await page.evaluate(() => ({
      bodyChildren: Array.from(document.body.children).map((el, i) => ({
        tag: el.tagName,
        id: el.id,
        hidden: el.hidden,
        class: el.className.substring(0, 40),
        innerFirst100: el.innerHTML.substring(0, 100),
      })),
      allIds: Array.from(document.querySelectorAll('[id]')).map(el => el.id).filter(Boolean),
    }));
    console.log(label + ' DOM:', JSON.stringify(dump, null, 2).substring(0, 1000));
  }

  await browser.close();
  return ok;
}

const httpOk = await testServer('HTTP', 'http://localhost:' + HTTP_PORT + '/pmo-dashboard');
const httpsOk = await testServer('HTTPS', 'https://localhost:' + HTTPS_PORT + '/pmo-dashboard');

console.log('\n=== RESULT ===');
console.log('HTTP:  ' + (httpOk ? 'PASS' : 'FAIL'));
console.log('HTTPS: ' + (httpsOk ? 'PASS' : 'FAIL'));

httpServer.close();
httpsServer.close();
