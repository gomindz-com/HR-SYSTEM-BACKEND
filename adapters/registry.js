const dahua = import('./dahua.js');
const suprema = import('./suprema.js');
const zkteco = import('./zkteco.js');

const adapters = {
    DAHUA: dahua,
    SUPREMA: suprema,
    ZKTECO: zkteco
};

/** Which vendors use a local stream (Suprema). DAHUA is true for registry but deviceManager skips starting it (DoLynk webhook only). */
const STREAMING_VENDORS = { DAHUA: true, SUPREMA: true, ZKTECO: false };

export const getAdapter = async (vendor) => {
    const key = vendor?.toUpperCase();
    const mod = key ? await adapters[key] : null;
    if (!mod) {
        throw new Error(`Adapter for vendor ${vendor} not found`);
    }
    return mod;
};

export const isStreamingDevice = (vendor) => {
    return !!STREAMING_VENDORS[vendor?.toUpperCase()];
};   
