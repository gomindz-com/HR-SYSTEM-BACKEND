const dahua = import('./dahua.js');
const suprema = import('./suprema.js');
const zkteco = import('./zkteco.js');





const adapters = {
    DAHUA: dahua,
    SUPREMA: suprema,
    ZKTECO: zkteco
}




export const getAdapter = (vendor) => {
    const adapter = adapters[vendor.toUpperCase()];

    if (!adapter) {
        throw new Error(`Adapter for vendor ${vendor} not found`);
    }

    return adapter;
}

