import { W } from '#shared';

const tags = new Map();

export const clearNames = () => {
    const layer = document.getElementById('n');
    if (layer) {
        layer.textContent = '';
    }
    tags.clear();
};

export const syncNames = (positions) => {
    const layer = document.getElementById('n');
    const canvas = document.getElementById('c');
    if (!layer || !canvas) return;
    const box = canvas.getBoundingClientRect();
    const scale = box.width / W;
    const live = new Set();

    for (const [id, cx, cy, hue, name] of positions) {
        live.add(id);
        let tag = tags.get(id);
        if (!tag) {
            tag = document.createElement('div');
            layer.appendChild(tag);
            tags.set(id, tag);
        }
        if (tag.textContent !== name) {
            tag.textContent = name;
        }
        const colour = `hsl(${hue} 90% 75%)`;
        if (tag.style.color !== colour) {
            tag.style.color = colour;
        }
        const x = Math.round(box.left + cx * scale);
        const y = Math.round(box.top + cy * scale) - 16;
        tag.style.transform = `translate(${x}px,${y}px) translateX(-50%)`;
    }

    for (const [id, tag] of tags) {
        if (live.has(id)) continue;
        tag.remove();
        tags.delete(id);
    }
};
