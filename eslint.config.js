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
    io: 'readonly',
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
