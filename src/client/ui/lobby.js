const el = (id) => document.getElementById(id);

export const hideLobby = () => { el('lobby').hidden = true; };

export const showLobby = (onReady, onBot) => {
    el('lobby').hidden = false;
    el('ready').onclick = onReady;
    el('botmore').onclick = () => onBot(1);
    el('botless').onclick = () => onBot(-1);
};

export const renderLobby = (net) => {
    el('lcode').textContent = `Lobby ${net.code}`;

    const list = el('ppl');
    list.textContent = '';
    for (const [id, hue] of net.players) {
        const li = document.createElement('li');
        li.style.color = `hsl(${hue} 90% 70%)`;
        li.textContent = net.readyOf(id) ? `${net.nameOf(id)} (ready)` : net.nameOf(id);
        list.appendChild(li);
    }

    el('bots').hidden = !net.isHost();
    el('ready').textContent = net.readyOf(net.myId) ? 'Not ready' : 'Ready';
};
