const IDS = {
    w: 'fw',
    o: 'los',
    s: 'sd',
    t: 'tmc',
};

export const award = (id) => {
    const sdk = globalThis.Wavedash;
    const key = IDS[id];
    if (sdk && key && !sdk.getAchievement(key)) {
        sdk.setAchievement(key, true);
    }
};
