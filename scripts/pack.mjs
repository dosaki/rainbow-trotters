#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { deflateRawSync, crc32 } from 'zlib';
import { execFileSync } from 'child_process';

const LIMIT = 13312;
const [appDir = 'app', outZip = 'dist/game.zip'] = process.argv.slice(2);

const walk = (dir) => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
});

const inlineScripts = (html, dir, consumed) =>
    html.replace(/<script\b[^>]*\bsrc=["']?([^"'\s>]+)["']?[^>]*><\/script>/g, (tag, src) => {
        if (/\bdata-keep\b/.test(tag)) return tag;
        const path = join(dir, src.replace(/^\.?\//, ''));
        let js;
        try {
            js = readFileSync(path, 'utf8');
        } catch {
            return tag;
        }
        if (/<\/script|<!--/i.test(js)) {
            throw new Error(`${src} contains </script or <!-- and cannot be inlined safely`);
        }
        consumed.add(path);
        return '<script>' + js + '</script>';
    });

const minifyHtml = (h) => h
    .replace(/<!--(?!\[if)[\s\S]*?-->/g, '')
    .split('\n').map((l) => l.trim()).join('')
    .replace(/>\s+</g, '><');

const zip = (entries) => {
    const locals = [], central = [];
    let offset = 0;
    for (const { name, data } of entries) {
        const nameBuf = Buffer.from(name, 'utf8');
        const comp = deflateRawSync(data, { level: 9 });
        const worthIt = comp.length < data.length;
        const body = worthIt ? comp : data;
        const meta = Buffer.alloc(26);
        meta.writeUInt16LE(20, 0);
        meta.writeUInt16LE(0, 2);
        meta.writeUInt16LE(worthIt ? 8 : 0, 4);
        meta.writeUInt32LE(0, 6);
        meta.writeUInt32LE(crc32(data) >>> 0, 10);
        meta.writeUInt32LE(body.length, 14);
        meta.writeUInt32LE(data.length, 18);
        meta.writeUInt16LE(nameBuf.length, 22);
        meta.writeUInt16LE(0, 24);

        locals.push(Buffer.from('PK\x03\x04', 'latin1'), meta, nameBuf, body);

        const cd = Buffer.alloc(42);
        cd.writeUInt16LE(20, 0);
        meta.copy(cd, 2, 0, 26);
        cd.writeUInt32LE(0, 34);
        cd.writeUInt32LE(offset, 38);
        central.push(Buffer.from('PK\x01\x02', 'latin1'), cd, nameBuf);

        offset += 30 + nameBuf.length + body.length;
    }
    const cdBuf = Buffer.concat(central);
    const eocd = Buffer.alloc(18);
    eocd.writeUInt16LE(entries.length, 4);
    eocd.writeUInt16LE(entries.length, 6);
    eocd.writeUInt32LE(cdBuf.length, 8);
    eocd.writeUInt32LE(offset, 12);
    return Buffer.concat([...locals, cdBuf, Buffer.from('PK\x05\x06', 'latin1'), eocd]);
};

const indexPath = join(appDir, 'index.html');
const consumed = new Set([indexPath]);
const html = inlineScripts(minifyHtml(readFileSync(indexPath, 'utf8')), appDir, consumed);

const entries = [
    { name: 'index.html', data: Buffer.from(html, 'utf8') },
    ...walk(appDir)
        .filter((p) => !consumed.has(p) && !p.endsWith('.map'))
        .map((p) => ({ name: relative(appDir, p).split(sep).join('/'), data: readFileSync(p) })),
];

writeFileSync(outZip, zip(entries));

try {
    execFileSync('advzip', ['-z', '-4', '-i', '1000', outZip], { stdio: 'ignore' });
} catch {
    console.warn('advzip not found: install advancecomp for ~2% more (brew install advancecomp)');
}

const size = statSync(outZip).size;
const left = LIMIT - size;
const detail = `${size} bytes, ${Math.abs(left)} ${left < 0 ? 'OVER' : 'left'}, ${entries.length} entr${entries.length > 1 ? 'ies' : 'y'}`;
console.log(left < 0 ? `\x1b[93m\x1b[1m[TOO BIG] ${detail}\x1b[39m` : `\x1b[92m\x1b[1m[OK] ${detail}\x1b[39m`);
process.exit(left < 0 ? 1 : 0);
