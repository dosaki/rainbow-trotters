import { mapAt } from '#shared';


export const hideLobby = () => { lobby.hidden = true; };

let shown = '';
let flashing = 0;

const flash = (text) => {
    cpy.textContent = text;
    clearTimeout(flashing);
    flashing = setTimeout(() => { cpy.textContent = 'Copy'; }, 1400);
};

const select = () => {
    try {
        const range = document.createRange();
        range.selectNodeContents(lcode);
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        flash('Ctrl+C');
    } catch {
    }
};

const copyCode = () => {
    if (!shown) return;
    try {
        navigator.clipboard.writeText(shown).then(() => flash('Copied'), select);
    } catch {
        select();
    }
};

export const showLobby = (onReady, onBot, onMap, onImport) => {
    lobby.hidden = false;
    ready.onclick = onReady;
    botmore.onclick = () => onBot(1);
    botless.onclick = () => onBot(-1);
    map.onclick = () => onMap(1);
    mapadd.onclick = () => onImport(mapin.value);
    cpy.onclick = copyCode;
};

export const renderLobby = (net) => {
    shown = net.code;
    lcode.textContent = shown || 'Single player';
    lc.className = shown ? '' : 'solo';
    cpy.hidden = !shown;

    const list = ppl;
    list.textContent = '';
    for (const [id, hue] of net.players) {
        const li = document.createElement('li');
        li.style.color = `hsl(${hue} 90% 70%)`;
        li.textContent = net.readyOf(id) ? `${net.nameOf(id)} (ready)` : net.nameOf(id);
        list.appendChild(li);
    }

    const host = net.isHost();
    const label = `Map: ${mapAt(net.map, net.custom).n}`;
    map.hidden = !host;
    map.textContent = label;
    mapname.hidden = host;
    mapname.textContent = label;

    imp.hidden = !host;
    bots.hidden = !host;
    ready.textContent = net.readyOf(net.myId) ? 'Not ready' : 'Ready';
};
