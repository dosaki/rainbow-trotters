import express from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

export const createSandbox = (extra = {}) => {
    const live = new Set();
    const wrap = (start, stop) => (...args) => {
        const h = start(...args);
        live.add([h, stop]);
        return h;
    };
    const sandbox = {
        console,
        setTimeout: wrap(setTimeout, clearTimeout),
        clearTimeout: (h) => clearTimeout(h),
        setInterval: wrap(setInterval, clearInterval),
        clearInterval: (h) => clearInterval(h),
        Buffer,
        module: { exports: {} },
        ...extra,
    };
    sandbox.global = sandbox;
    return {
        sandbox,
        dispose: () => {
            for (const [h, stop] of live) {
                stop(h);
            }
            live.clear();
        },
    };
};

export const startHarness = async (dir, port = 0) => {
    const app = express();
    app.use(express.static(dir));
    const http = createServer(app);
    const io = new Server(http);

    const mem = new Map();
    const storage = {
        get: (k) => Promise.resolve(mem.get(k)),
        set: (k, v) => { mem.set(k, v); return Promise.resolve(); },
    };

    const { sandbox, dispose } = createSandbox({ storage, io });

    const server = readFileSync(join(dir, 'server.js'), 'utf8');
    vm.runInNewContext(server, sandbox, { filename: 'server.js' });

    const exported = sandbox.module.exports;
    const handler = typeof exported === 'function' ? exported : exported && exported.io;
    if (typeof handler !== 'function') {
        throw new Error('server.js exported neither a function nor an { io } handler');
    }
    io.on('connection', handler);

    await new Promise((r) => http.listen(port, r));
    const url = `http://localhost:${http.address().port}/`;
    return {
        url,
        sandbox,
        close: () => new Promise((r) => { dispose(); io.close(); http.close(r); }),
    };
};

if (process.argv[1] && process.argv[1].endsWith('harness.mjs')) {
    const h = await startHarness(process.argv[2] || 'public', Number(process.argv[3] || 3000));
    console.log(`harness listening on ${h.url}`);
}
