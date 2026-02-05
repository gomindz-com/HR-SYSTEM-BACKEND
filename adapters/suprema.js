import WebSocket from 'ws';
import axios from 'axios';

const activeSockets = new Map();
export const isStreaming = true; // WebSocket is a stream

export const startListening = (device, vendorConfig, onEvent) => {
    const ws = new WebSocket(`${vendorConfig.apiUrl.replace('http', 'ws')}/notifications`, {
        headers: { 'Authorization': `Bearer ${vendorConfig.apiKey}` }
    });

    ws.on('message', (data) => {
        const message = JSON.parse(data);
        if (message.event_type_id) { // Real-time MessageEvent
            onEvent({
                companyId: device.companyId,
                deviceId: device.id,
                biometricUserId: message.user_id?.toString(),
                timestamp: new Date(message.datetime),
                eventType: message.event_type_code === 4096 ? 'CHECK_IN' : 'CHECK_OUT'
            });
        }
    });

    ws.on('error', () => setTimeout(() => startListening(device, vendorConfig, onEvent), 5000));
    activeSockets.set(device.id, ws);
    return () => stopListening(device.id);
};

export const stopListening = (deviceId) => {
    const ws = activeSockets.get(deviceId);
    if (ws) { ws.close(); activeSockets.delete(deviceId); }
};

// Suprema 2026: Supports testing via Virtual Device API
export const triggerVirtualEvent = async (vendorConfig, deviceId, userId) => {
    return axios.post(`${vendorConfig.apiUrl}/api/events/import`, {
        device_id: deviceId,
        user_id: userId,
        event_type_code: 4096 // Access Granted
    }, { headers: { 'Authorization': `Bearer ${vendorConfig.apiKey}` } });
};