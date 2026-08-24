const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LEN = 4;

export const makeCode = () => {
    let c = '';
    for (let i = 0; i < CODE_LEN; i++) {
        c += ALPHABET[(Math.random() * ALPHABET.length) | 0];
    }
    return c;
};

export const cleanCode = (code) => String(code == null ? '' : code).trim().toUpperCase();
