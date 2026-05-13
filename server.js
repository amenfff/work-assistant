const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function serveFile(filePath, res) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  // Normalize URL: remove query string, ensure leading /
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  // Security: prevent path traversal
  // Remove leading / so path.join doesn't discard ROOT
  const safeUrl = path.normalize(url).replace(/^[/\\]+/, '');
  const filePath = path.join(ROOT, safeUrl);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  serveFile(filePath, res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('工作助手已启动: http://localhost:' + PORT);
});
