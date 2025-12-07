const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const ROOT = path.resolve(__dirname);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function send(res, status, contentType, body) {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
  });
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 500, 'text/plain', 'Internal server error');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    send(res, 200, type, data);
  });
}

function safePath(requestUrl) {
  const parsed = url.parse(requestUrl);
  let pathname = parsed.pathname || '/';
  try {
    pathname = decodeURIComponent(pathname);
  } catch (err) {
    return null;
  }
  const target = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, target);
  if (!filePath.startsWith(`${ROOT}${path.sep}`)) return null;
  return filePath;
}

function createServer() {
  return http.createServer((req, res) => {
    const filePath = safePath(req.url || '/');
    if (!filePath) {
      send(res, 400, 'text/plain', 'Bad request');
      return;
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        send(res, 404, 'text/plain', 'Not found');
        return;
      }
      serveFile(res, filePath);
    });
  });
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Neon Sweep server running at http://localhost:${PORT}`);
  });
}

module.exports = { createServer, safePath, ROOT };
