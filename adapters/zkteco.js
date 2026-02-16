// ZKTeco 2026: ADMS Push Protocol Parser
export const isStreaming = false; // Passive listener

// Parses ZKTeco's raw tab-delimited ADMS payload
export const parsePushPayload = (rawData, device) => {
    // Example: 2\t2026-02-03 12:00:00\t1\t15...
    const lines = rawData.trim().split('\n');
    return lines.map(line => {
        const fields = line.split('\t');
        return {
            companyId: device.companyId,
            deviceId: device.id,
            biometricUserId: fields[0], // User PIN
            timestamp: new Date(fields[1]),
            eventType: fields[2] === '0' ? 'CHECK_IN' : 'CHECK_OUT' // 0=In, 1=Out
        };
    });
};

export const testConnection = async (device, vendorConfig) => {
    // ZKTeco devices 'check-in' to us. We test by checking the last 'seen' 
    // timestamp in the database for this device serial number.
    return !!device.lastSeen && (Date.now() - new Date(device.lastSeen) < 300000);
};