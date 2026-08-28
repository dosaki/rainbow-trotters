import { load, save } from './ui/menu.js';
import { showToast } from './ui/toast.js';

const KEY = 'rt.a';

const NAMES = {
    w: 'First Win',
    o: 'Survivor',
    s: 'Snake',
    t: 'Taste My Colour',
};

let got;

export const award = (id) => {
    got ??= load(KEY);
    if (got.includes(id)) return;
    got += id;
    save(KEY, got);
    showToast(NAMES[id]);
};
