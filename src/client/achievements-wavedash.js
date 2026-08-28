const IDS = {
    w: 'first_win',
    o: 'last_one_standing',
    s: 'snake_death',
    t: 'taste_my_colour',
};

export const award = (id) => {
    const sdk = globalThis.Wavedash;
    const key = IDS[id];
    if (sdk && key && !sdk.getAchievement(key)) {
        sdk.setAchievement(key, true);
    }
};
