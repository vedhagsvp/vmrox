require('dotenv').config();
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Config
const REMOTE_HOSTS = process.env.REMOTE_HOSTS.split(',').map(h => h.trim());
const REMOTE_PORT = process.env.REMOTE_PORT || 443;
const LOCAL_HOST = process.env.LOCAL_HOST || '0.0.0.0';
const LOCAL_PORT = parseInt(process.env.LOCAL_PORT, 10) || 57542;
const REMOTE_PASSWORD = process.env.REMOTE_PASSWORD || null;

// Helper to forward request to the first available remote host
function forwardRequest(req, res) {
  const tryHost = (index) => {
    if (index >= REMOTE_HOSTS.length) {
      res.writeHead(502);
      return res.end('All remote hosts failed');
    }

    const hostname = REMOTE_HOSTS[index];
    const options = {
      hostname,
      port: REMOTE_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        ...(REMOTE_PASSWORD ? { 'x-password': REMOTE_PASSWORD } : {}),
        host: hostname
      }
    };

    const proxy = https.request(options, (remoteRes) => {
      res.writeHead(remoteRes.statusCode, remoteRes.headers);
      remoteRes.pipe(res, { end: true });
    });

    proxy.on('error', (err) => {
      console.error(`Error with ${hostname}: ${err.message}`);
      tryHost(index + 1); // try next host
    });

    req.pipe(proxy, { end: true });
  };

  tryHost(0);
}

// Start local HTTP server
const server = http.createServer(forwardRequest);

server.listen(LOCAL_PORT, LOCAL_HOST, () => {
  console.log(`Proxy running at http://${LOCAL_HOST}:${LOCAL_PORT}/`);
});
