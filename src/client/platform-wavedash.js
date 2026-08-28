export const platformReady = () => {
    const sdk = globalThis.Wavedash;
    if (sdk && sdk.init) {
        sdk.init();
        if (sdk.requestStats) {
            sdk.requestStats();
        }
    }
};
