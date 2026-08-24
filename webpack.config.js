import path from 'path';

const out = path.resolve(process.cwd(), 'public');

export default {
    mode: 'production',
    devtool: false,
    optimization: { minimize: false },
    name: 'client',
    entry: './src/client/index.js',
    output: { path: out, filename: 'client.js' },
};
