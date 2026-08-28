import path from 'path';
import webpack from 'webpack';

const out = path.resolve(process.cwd(), 'public');
const wavedash = process.env.WAVEDASH === '1';

const swap = (from, to) => new webpack.NormalModuleReplacementPlugin(from, (res) => {
    res.request = path.resolve(process.cwd(), to);
});

export default {
    mode: 'production',
    devtool: false,
    optimization: { minimize: false },
    name: 'client',
    entry: './src/client/index.js',
    output: { path: out, filename: 'client.js' },
    plugins: wavedash
        ? [
            swap(/(^|\/)platform\.js$/, 'src/client/platform-wavedash.js'),
            swap(/host\/session\.js$/, 'src/client/host/wd-session.js'),
        swap(/(^|\/)achievements\.js$/, 'src/client/achievements-wavedash.js'),
        ]
        : [],
};
