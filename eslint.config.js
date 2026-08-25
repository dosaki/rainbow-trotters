const ES = {
    console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly',
    setInterval: 'readonly', clearInterval: 'readonly',
};

const BROWSER = {
    ...ES,
    document: 'readonly', window: 'readonly', location: 'readonly',
    addEventListener: 'readonly', requestAnimationFrame: 'readonly',
    innerWidth: 'readonly', innerHeight: 'readonly',
    localStorage: 'readonly', AudioContext: 'readonly',
    WebSocket: 'readonly', navigator: 'readonly', getSelection: 'readonly', matchMedia: 'readonly',
    TextEncoder: 'readonly', TextDecoder: 'readonly',
    io: 'readonly',
    c: 'readonly', h: 'readonly', o: 'readonly', n: 'readonly', t: 'readonly',
    menu: 'readonly', lobby: 'readonly', err: 'readonly', nm: 'readonly',
    solo: 'readonly', auto: 'readonly', make: 'readonly', code: 'readonly',
    join: 'readonly', lcode: 'readonly', ppl: 'readonly', ready: 'readonly',
    quit: 'readonly', bots: 'readonly', botmore: 'readonly', botless: 'readonly',
    map: 'readonly', mapname: 'readonly', imp: 'readonly', mapin: 'readonly',
    mapadd: 'readonly', mute: 'readonly', lc: 'readonly', cpy: 'readonly', lclab: 'readonly', lcrow: 'readonly', hint: 'readonly',
};

const SANDBOX = { ...ES, Buffer: 'readonly', storage: 'readonly', io: 'readonly', module: 'writable' };

const rules = {
    'no-undef': 'error',
    'no-unused-vars': ['error', { args: 'none' }],
};

export default [
    {
        files: ['src/shared/**/*.js', 'src/server/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: SANDBOX },
        rules,
    },
    {
        files: ['src/client/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: BROWSER },
        rules,
    },
];
