import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { join, extname, normalize } from 'path';
import { attachRelay } from './relay.mjs';

const TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
};

const serve = (dir) => (req, res) => {
    const path = (req.url || '/').split('?')[0];
    const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.(\/|\\|$))+/, '');
    const file = join(dir, rel);
    if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
        return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
};

export const startHarness = async (dir, port = 0) => {
    const server = createServer(serve(dir));
    const wss = attachRelay(server);
    await new Promise((r) => server.listen(port, r));
    const bound = server.address().port;
    return {
        port: bound,
        url: `http://localhost:${bound}/`,
        relay: `ws://localhost:${bound}`,
        close: () => new Promise((r) => {
            for (const client of wss.clients) {
                client.terminate();
            }
            wss.close(() => server.close(r));
        }),
    };
};

if (process.argv[1] && process.argv[1].endsWith('harness.mjs')) {
    const h = await startHarness(process.argv[2] || 'public', Number(process.argv[3] || 3000));
    console.log(`serving with a relay on ${h.url}`);
}
