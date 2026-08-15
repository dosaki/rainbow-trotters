import { mapName } from '#shared';

const el = (id) => document.getElementById(id);

export const hideLobby = () => { el('lobby').hidden = true; };

export const showLobby = (onReady, onBot, onMap) => {
    el('lobby').hidden = false;
    el('ready').onclick = onReady;
    el('botmore').onclick = () => onBot(1);
    el('botless').onclick = () => onBot(-1);
    el('map').onclick = () => onMap(1);
};

export const renderLobby = (net) => {
    el('lcode').textContent = net.code ? `Lobby ${net.code}` : 'Single player';

    const list = el('ppl');
    list.textContent = '';
    for (const [id, hue] of net.players) {
        const li = document.createElement('li');
        li.style.color = `hsl(${hue} 90% 70%)`;
        li.textContent = net.readyOf(id) ? `${net.nameOf(id)} (ready)` : net.nameOf(id);
        list.appendChild(li);
    }

    const host = net.isHost();
    const label = `Map: ${mapName(net.map)}`;
    el('map').hidden = !host;
    el('map').textContent = label;
    el('mapname').hidden = host;
    el('mapname').textContent = label;

    el('bots').hidden = !host;
    el('ready').textContent = net.readyOf(net.myId) ? 'Not ready' : 'Ready';
};
