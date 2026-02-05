import axios from "axios";

const activeStreams = new Map();
export const isStreaming = true; // Added for Registry lookup

const parseDahuaChunk = (chunk) => {
    const match = chunk.match(/data=({.*?})/);
    return match ? JSON.parse(match[1]) : null;
};

const normalizeEvent = (device, rawEvent) => ({
    companyId: device.companyId,
    deviceId: device.id,
    biometricUserId: rawEvent.UserID?.toString() || rawEvent.CardNo?.toString(),
    timestamp: new Date(rawEvent.UTC * 1000),
    eventType: 'CHECK_IN'
});

export const startListening = async (device, onEvent) => {
    // heartBeat=5 tells Dahua to send a packet every 5 seconds
    const url = `http://${device.host}:${device.port || 80}/cgi-bin/snapManager.cgi?action=attachFileProc&Flags[0]=Event&Events=[AccessControl]&heartbeat=5`;
    let lastEventTime = Date.now();

    const connectToDevice = () => {
        const source = axios.CancelToken.source();
        axios({
            method: 'get', url,
            auth: { username: device.username, password: device.password },
            responseType: 'stream',
            cancelToken: source.token
        }).then(response => {
            console.log(`[Dahua] Connected to ${device.name}`);
            
            // Heartbeat Monitor: Restart if silent for 60s
            const monitor = setInterval(() => {
                if (Date.now() - lastEventTime > 60000) {
                    console.warn(`[Dahua] Stream timeout for ${device.name}. Restarting...`);
                    stopListening(device.id);
                    connectToDevice();
                }
            }, 30000);

            response.data.on('data', chunk => {
                lastEventTime = Date.now();
                const rawEvent = parseDahuaChunk(chunk.toString());
                if (rawEvent) onEvent(normalizeEvent(device, rawEvent));
            });

            activeStreams.set(device.id, { stream: response.data, source, monitor });
        }).catch(err => {
            setTimeout(connectToDevice, 10000);
        });
    };

    connectToDevice();
    return () => stopListening(device.id);
};

export const stopListening = (deviceId) => {
    const entry = activeStreams.get(deviceId);
    if (entry) {
        clearInterval(entry.monitor);
        entry.source.cancel();
        activeStreams.delete(deviceId);
    }
};

export const testConnection = async (device) => {
    try {
        const res = await axios.get(`http://${device.host}/cgi-bin/configManager.cgi?action=getConfig&name=General`, {
            auth: { username: device.username, password: device.password },
            timeout: 5000
        });
        return res.status === 200;
    } catch { return false; }
};