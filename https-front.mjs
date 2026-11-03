// TLS in front of `next start`, which has no certificate option of its own. Plain node
// https + http, no dependency. The app reads x-forwarded-proto to decide the cookie's
// Secure flag, so that header is the whole contract: it is set here, not trusted from
// outside, because nothing terminates TLS before this process.
import { request } from 'node:http';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';

const PORT = Number(process.env.HTTPS_PORT || 3443);
const APP = Number(process.env.APP_PORT || 3000);

const server = createServer(
  { key: readFileSync('certs/key.pem'), cert: readFileSync('certs/cert.pem') },
  (req, res) => {
    const up = request(
      { port: APP, host: '127.0.0.1', path: req.url, method: req.method, headers: { ...req.headers, 'x-forwarded-proto': 'https' } },
      (out) => {
        res.writeHead(out.statusCode, out.headers);
        out.pipe(res);
      }
    );
    up.on('error', () => res.destroy());
    req.pipe(up);
  }
);

server.listen(PORT, '0.0.0.0', () => console.log(`https on :${PORT} -> app on :${APP}`));
