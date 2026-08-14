import path from 'path';

const out = path.resolve(process.cwd(), 'public');
const base = { mode: 'production', devtool: false, optimization: { minimize: false } };

const usesShared = { '#shared': 'S' };

export default [
    {
        ...base,
        name: 'shared',
        entry: './src/shared/index.js',
        output: {
            path: out,
            filename: 'shared.js',
            library: { type: 'var', name: 'S' },
        },
    },
    {
        ...base,
        name: 'client',
        entry: './src/client/index.js',
        externals: usesShared,
        externalsType: 'var',
        output: { path: out, filename: 'client.js' },
    },
    {
        ...base,
        name: 'server',
        entry: './src/server/index.js',
        externals: usesShared,
        externalsType: 'var',
        target: 'node',
        output: {
            path: out,
            filename: 'server.js',
            library: { type: 'commonjs2', export: 'default' },
        },
    },
];
