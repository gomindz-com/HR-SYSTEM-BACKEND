const dahua = import('./dahua.js');
const suprema = import('./suprema.js');
const zkteco = import('./zkteco.js');

const adapters = {
    DAHUA: dahua,
    SUPREMA: suprema,
    ZKTECO: zkteco
};

/** Sync map: which vendors use streaming (Dahua/Suprema) vs push (ZKTeco) */
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
