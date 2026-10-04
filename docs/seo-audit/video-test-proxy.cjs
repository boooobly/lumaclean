// Local-only video delivery checks; never forwards lead submissions.
// node docs/seo-audit/video-test-proxy.cjs [port=3012] [slow|fail]
// Run `npm run start -- --port 3010` first. Use a fresh origin for cold-cache checks.
const http = require('node:http');
const port = Number(process.argv[2] || 3012);
const mode = process.argv[3] || 'slow';
http.createServer((req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405).end();
    return;
  }
  const video = req.url.includes('/journey-v5/') && req.url.includes('.mp4');
  if (video && mode === 'fail') {
    res.writeHead(503, {'Cache-Control': 'no-store'}).end();
    return;
  }
  const upstream = http.request({
    hostname: 'localhost', port: 3010, path: req.url, method: req.method,
    headers: {...req.headers, host: 'localhost:3010'},
  }, (response) => {
    res.writeHead(response.statusCode, {...response.headers, 'cache-control': 'no-store'});
    if (!video || req.method === 'HEAD') {
      response.pipe(res);
      return;
    }
    const started = Date.now();
    let bytes = 0;
    console.log('VIDEO', req.url, response.statusCode, req.headers.range);
    response.pause();
    const timer = setInterval(() => {
      const chunk = response.read(32768);
      if (chunk) { res.write(chunk); bytes += chunk.length; }
    }, 250);
    response.on('end', () => { clearInterval(timer); res.end(); });
    res.on('close', () => {
      clearInterval(timer);
      response.destroy();
      console.log('CLOSE', bytes, `${Date.now() - started}ms`);
    });
  });
  upstream.on('error', () => { res.writeHead(502).end(); });
  upstream.end();
}).listen(port, '127.0.0.1', () => console.log(`Local video test: ${port}, ${mode}, 128 KiB/s per response`));
