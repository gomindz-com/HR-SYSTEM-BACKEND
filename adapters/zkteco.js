// zkteco.js
import axios from 'axios';

/**
 * Map ZKTeco check type to our event type
 */
const mapCheckType = (checktype) => {
    return (checktype === 0 || checktype === 'I') ? 'CHECK_IN' : 'CHECK_OUT';
};

/**
 * Parse ZKTeco webhook payload
 * This is called by your webhook endpoint when ZKTeco sends data
 */
const parseWebhookPayload = (payload, device) => ({
    companyId: device.companyId,
    deviceId: device.id,
    biometricUserId: payload.pin?.toString() || payload.userid?.toString(),
    timestamp: new Date(payload.atttime || payload.checktime),
    eventType: mapCheckType(payload.checktype)
});

/**
 * Test connection to ZKTeco device/API
 */
const testConnection = async (device, vendorConfig) => {
    // If cloud-based with API
    if (vendorConfig && vendorConfig.apiUrl) {
        try {
            const response = await axios({
                method: 'get',
                url: `${vendorConfig.apiUrl}/devices/${device.cloudDeviceId}`,
                headers: {
                    'Authorization': `Bearer ${vendorConfig.apiKey}`
                },
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            console.error(`[ZKTeco] Failed to test connection: ${error.message}`);
            return false;
        }
    }
    
    // For local ZKTeco devices, just return true
    // (or implement actual connection test if you support local ZKTeco)
    return true;
};

export { parseWebhookPayload, testConnection };