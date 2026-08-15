import { W, MAX_PLAYERS } from '#shared';

const tags = [];

export const clearNames = () => {
    for (const t of tags) {
        t.textContent = '';
    }
};

export const syncNames = (positions) => {
    while (tags.length < MAX_PLAYERS) {
        tags.push(n.appendChild(document.createElement('div')));
    }
    for (const t of tags) {
        t.textContent = '';
    }
    for (const [id, cx, cy, hue, name] of positions) {
        const t = tags[id];
        t.textContent = name;
        t.style.color = `hsl(${hue} 90% 75%)`;
        t.style.left = `${cx * 100 / W}%`;
        t.style.top = `${cy * 100 / W}%`;
    }
};
